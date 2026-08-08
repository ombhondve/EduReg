from shared.model import controller


class student_models(controller):
    """Data layer for the student-facing portal. Deliberately reuses the
    same tables collage_models writes to (students, courses, fees,
    documents, messages, timetable, calendar_events, notifications,
    attendance) — a student's portal is just their own scoped view of the
    data the college dashboard already manages, so there's one source of
    truth instead of a parallel copy.
    """

    def __init__(self, organization_id=None):
        if organization_id is None:
            # Same guard as collage_models — a student row only means
            # anything inside its owning tenant's database, so never
            # silently fall back to a shared/default connection.
            raise ValueError("student_models requires an organization_id")
        super().__init__(organization_id=organization_id)

    # ------------------------------------------------------------------
    # Generic helpers (same small trio used by collage_models)
    # ------------------------------------------------------------------

    def _query_all(self, query, params=()):
        try:
            self.cur.execute(query, params)
            return self.cur.fetchall()
        except Exception as e:
            print(e)
            return []

    def _query_one(self, query, params=()):
        try:
            self.cur.execute(query, params)
            return self.cur.fetchone()
        except Exception as e:
            print(e)
            return None

    def _execute(self, query, params=(), return_row_query=None, return_row_params=None):
        try:
            self.cur.execute(query, params)
            self.conn.commit()
            if return_row_query:
                self.cur.execute(return_row_query, return_row_params or ())
                return self.cur.fetchone()
            return self.cur.lastrowid or True
        except Exception as e:
            print(e)
            self.conn.rollback()
            return None

    def _time_ago(self, value):
        if not value:
            return ""
        try:
            from datetime import datetime
            dt = value if hasattr(value, "year") else datetime.strptime(str(value), "%Y-%m-%d %H:%M:%S")
            seconds = (datetime.now() - dt).total_seconds()
            if seconds < 60:
                return "just now"
            if seconds < 3600:
                return f"{int(seconds // 60)}m ago"
            if seconds < 86400:
                return f"{int(seconds // 3600)}h ago"
            return f"{int(seconds // 86400)}d ago"
        except Exception as e:
            print(e)
            return ""

    # ------------------------------------------------------------------
    # Profile
    # ------------------------------------------------------------------

    def get_profile(self, student_id):
        row = self._query_one(
            """
            SELECT s.*, c.name AS course, c.course_code AS courseCode
            FROM students s
            LEFT JOIN courses c ON c.id = s.course_id
            WHERE s.id = %s
            """,
            (student_id,),
        )
        if not row:
            return None
        row = dict(row)
        row.pop("hashed_password", None)
        row.pop("reset_token", None)
        row["name"] = f"{row.get('firstName', '')} {row.get('lastName', '')}".strip()
        return row

    def get_courses(self, student_id):
        profile = self.get_profile(student_id)
        if not profile or not profile.get("course_id"):
            return []
        return [{
            "id": profile.get("course_id"),
            "name": profile.get("course"),
            "courseCode": profile.get("courseCode"),
            "year": profile.get("year"),
            "status": profile.get("status"),
        }]

    # ------------------------------------------------------------------
    # Grades
    # ------------------------------------------------------------------

    def get_grades(self, student_id):
        rows = self._query_all(
            """
            SELECT g.term, g.grade, g.status, c.name AS course
            FROM grades g
            LEFT JOIN courses c ON c.id = g.course_id
            WHERE g.student_id = %s
            ORDER BY g.term DESC
            """,
            (student_id,),
        )
        if rows:
            return rows
        # No per-course grade rows yet — fall back to the student's overall GPA
        # so the page still shows something meaningful instead of an empty table.
        profile = self.get_profile(student_id)
        if not profile:
            return []
        return [{
            "course": profile.get("course") or "",
            "term": profile.get("year") or "",
            "grade": profile.get("gpa") or 0,
            "status": "Published",
        }]

    # ------------------------------------------------------------------
    # Attendance
    # ------------------------------------------------------------------

    def get_attendance(self, student_id):
        rows = self._query_all(
            """
            SELECT a.date, a.status, c.name AS course
            FROM attendance a
            LEFT JOIN courses c ON c.id = a.course_id
            WHERE a.student_id = %s
            ORDER BY a.date DESC
            """,
            (student_id,),
        )
        total = len(rows)
        present = len([r for r in rows if r["status"] == "Present"])
        overall = round((present / total) * 100, 1) if total else 0

        by_course = {}
        for r in rows:
            key = r.get("course") or "Unknown"
            by_course.setdefault(key, {"course": key, "total": 0, "present": 0})
            by_course[key]["total"] += 1
            if r["status"] == "Present":
                by_course[key]["present"] += 1
        for entry in by_course.values():
            entry["percent"] = round((entry["present"] / entry["total"]) * 100, 1) if entry["total"] else 0

        return {
            "overall": overall,
            "byCourse": list(by_course.values()),
            "recent": rows[:10],
        }

    # ------------------------------------------------------------------
    # Fees
    # ------------------------------------------------------------------

    def get_fees(self, student_id):
        rows = self._query_all(
            "SELECT * FROM fees WHERE student_id = %s ORDER BY due_date DESC",
            (student_id,),
        )
        total_due = sum(float(r["amount"]) for r in rows if r["status"] != "Paid")
        total_paid = sum(float(r["amount"]) for r in rows if r["status"] == "Paid")
        status = "No dues" if total_due == 0 else "Payment due"
        return {
            "status": status if rows else "No dues recorded",
            "totalDue": total_due,
            "totalPaid": total_paid,
            "history": rows,
        }

    # ------------------------------------------------------------------
    # Notices — reuses the collage dashboard's notifications table,
    # showing anything addressed to "all" or specifically to this student.
    # ------------------------------------------------------------------

    def get_notices(self, student_id):
        rows = self._query_all(
            """
            SELECT * FROM notifications
            WHERE audience = 'all' OR student_id = %s
            ORDER BY created_at DESC
            """,
            (student_id,),
        )
        for row in rows:
            row["sentAgo"] = self._time_ago(row.pop("created_at", None))
        return rows

    # ------------------------------------------------------------------
    # Documents
    # ------------------------------------------------------------------

    def get_documents(self, student_id):
        return self._query_all(
            "SELECT * FROM documents WHERE student_id = %s ORDER BY uploaded_at DESC",
            (student_id,),
        )

    def add_document(self, student_id, doc_type, file_name, file_path, mime_type, size_bytes, status="Pending Review"):
        row = self._execute(
            """
            INSERT INTO documents
                (student_id, doc_type, file_name, file_path, mime_type, size_bytes, status, uploaded_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            """,
            (student_id, doc_type, file_name, file_path, mime_type, size_bytes, status),
            return_row_query="SELECT * FROM documents WHERE id = LAST_INSERT_ID()",
        )
        return row or {"error": "Failed to save document"}

    # ------------------------------------------------------------------
    # Messages
    # ------------------------------------------------------------------

    def get_messages(self, student_id):
        return self._query_all(
            "SELECT * FROM messages WHERE student_id = %s ORDER BY created_at ASC",
            (student_id,),
        )

    def add_message(self, student_id, student_name, body, sender="student"):
        row = self._execute(
            "INSERT INTO messages (student_id, student_name, body, sender, created_at) VALUES (%s, %s, %s, %s, NOW())",
            (student_id, student_name, body, sender),
            return_row_query="SELECT * FROM messages WHERE id = LAST_INSERT_ID()",
        )
        return row or {"error": "Failed to send message"}

    # ------------------------------------------------------------------
    # Timetable — this student's own course schedule
    # ------------------------------------------------------------------

    def get_timetable(self, student_id):
        profile = self.get_profile(student_id)
        if not profile or not profile.get("course_id"):
            return []
        return self._query_all(
            """
            SELECT t.*, c.name AS courseName
            FROM timetable t
            LEFT JOIN courses c ON c.id = t.course_id
            WHERE t.course_id = %s
            ORDER BY FIELD(t.day,'Mon','Tue','Wed','Thu','Fri','Sat','Sun'), t.start_time
            """,
            (profile["course_id"],),
        )

    # ------------------------------------------------------------------
    # Calendar
    # ------------------------------------------------------------------

    def get_calendar(self):
        return self._query_all(
            "SELECT * FROM calendar_events WHERE event_date >= CURDATE() ORDER BY event_date"
        )
