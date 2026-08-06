from flask import jsonify
from shared.model import controller


class collage_models(controller):
    """Data layer for a single college/organization's own dashboard
    (students, courses, documents, attendance, fees, timetable, calendar,
    messages, staff, notifications, activity log).

    Every public method below is a thin, purpose-specific wrapper around
    the three generic helpers (_query_all / _query_one / _execute) so new
    endpoints only ever need a SQL string, not new plumbing.
    """

    def __init__(self):
        super().__init__()

    # ------------------------------------------------------------------
    # Generic helpers — every other method in this class is built on these.
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
        """Runs an INSERT/UPDATE/DELETE and commits. If `return_row_query`
        is given, fetches and returns that row after the write (handy for
        "insert then hand back the created record" endpoints); otherwise
        returns the new auto-increment id (or True for statements with no
        useful id, e.g. UPDATE/DELETE)."""
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

    @staticmethod
    def _student_name(row):
        return f"{row.get('firstName', '')} {row.get('lastName', '')}".strip()

    def _format_student(self, row):
        if not row:
            return None
        row = dict(row)
        row.pop("hashed_password", None)
        row.pop("reset_token", None)
        row["name"] = self._student_name(row)
        return row

    # ------------------------------------------------------------------
    # Dashboard stats
    # ------------------------------------------------------------------

    def fetch_dashboard_stats(self):
        total_students = self._query_one("SELECT COUNT(*) AS c FROM students") or {"c": 0}
        active_students = self._query_one("SELECT COUNT(*) AS c FROM students WHERE status='Active'") or {"c": 0}
        total_courses = self._query_one("SELECT COUNT(*) AS c FROM courses") or {"c": 0}
        pending_docs = self._query_one("SELECT COUNT(*) AS c FROM documents WHERE status='Pending Review'") or {"c": 0}
        unpaid_fees = self._query_one("SELECT COUNT(*) AS c FROM fees WHERE status!='Paid'") or {"c": 0}
        fees_collected = self._query_one("SELECT COALESCE(SUM(amount),0) AS s FROM fees WHERE status='Paid'") or {"s": 0}
        upcoming_events = self._query_one(
            "SELECT COUNT(*) AS c FROM calendar_events WHERE event_date >= CURDATE()"
        ) or {"c": 0}

        return {
            "totalStudents": int(total_students["c"] or 0),
            "activeStudents": int(active_students["c"] or 0),
            "totalCourses": int(total_courses["c"] or 0),
            "pendingDocuments": int(pending_docs["c"] or 0),
            "unpaidFees": int(unpaid_fees["c"] or 0),
            "feesCollected": float(fees_collected["s"] or 0),
            "upcomingEvents": int(upcoming_events["c"] or 0),
        }

    # ------------------------------------------------------------------
    # Students
    # ------------------------------------------------------------------

    def fetch_students_data(self, search="", course="", status=""):
        query = """
            SELECT s.*, c.name AS courseName
            FROM students s
            LEFT JOIN courses c ON c.id = s.course_id
            WHERE 1=1
        """
        params = []
        if search:
            query += " AND (s.firstName LIKE %s OR s.lastName LIKE %s OR s.email LIKE %s)"
            params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])
        if course:
            query += " AND s.course_id = %s"
            params.append(course)
        if status:
            query += " AND s.status = %s"
            params.append(status)
        query += " ORDER BY s.id DESC"
        rows = self._query_all(query, params)
        return [self._format_student(row) for row in rows]

    def fetch_student_data(self, student_id):
        row = self._query_one(
            """
            SELECT s.*, c.name AS courseName
            FROM students s
            LEFT JOIN courses c ON c.id = s.course_id
            WHERE s.id = %s
            """,
            (student_id,),
        )
        if not row:
            return jsonify({"error": "Student not found"}), 404
        return jsonify(self._format_student(row)), 200

    def Add_new_student(self, data):
        row = self._execute(
            """
            INSERT INTO students
                (firstName, lastName, email, phone, dob, gender, address, course_id, year, gpa, status, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                data.get("firstName"), data.get("lastName"), data.get("email"),
                data.get("phone"), data.get("dob"), data.get("gender"), data.get("address"),
                data.get("course_id"), data.get("year"), data.get("gpa"),
                data.get("status", "Active"), data.get("notes", ""),
            ),
        )
        if not row:
            return jsonify({"error": "Failed to add student"}), 500
        return self.fetch_student_data(row if isinstance(row, int) else row.get("id"))

    def update_student(self, student_id, data):
        fields = ["firstName", "lastName", "email", "phone", "dob", "gender",
                   "address", "course_id", "year", "gpa", "status", "notes"]
        updates = [f for f in fields if f in data]
        if not updates:
            return jsonify({"error": "No fields to update"}), 400
        set_clause = ", ".join(f"{f}=%s" for f in updates)
        values = [data[f] for f in updates] + [student_id]
        result = self._execute(f"UPDATE students SET {set_clause} WHERE id=%s", values)
        if result is None:
            return jsonify({"error": "Failed to update student"}), 500
        return self.fetch_student_data(student_id)

    def Delete_student(self, student_id):
        result = self._execute("DELETE FROM students WHERE id=%s", (student_id,))
        if result is None:
            return jsonify({"error": "Failed to delete student"}), 500
        return jsonify({"message": "Student deleted successfully"}), 200

    def fetch_students_export(self):
        rows = self._query_all(
            """
            SELECT s.id, s.firstName, s.lastName, s.email, s.phone, s.dob, s.gender,
                   s.address, c.name AS course, s.year, s.gpa, s.status, s.notes
            FROM students s
            LEFT JOIN courses c ON c.id = s.course_id
            ORDER BY s.id
            """
        )
        return rows

    # ------------------------------------------------------------------
    # Courses
    # ------------------------------------------------------------------

    def fetch_courses_data(self):
        return self._query_all(
            """
            SELECT c.*, COUNT(s.id) AS enrolled
            FROM courses c
            LEFT JOIN students s ON s.course_id = c.id
            GROUP BY c.id
            ORDER BY c.name
            """
        )

    # ------------------------------------------------------------------
    # Analytics
    # ------------------------------------------------------------------

    def fetch_analytics_data(self):
        by_course = self._query_all(
            """
            SELECT c.name AS course, COUNT(s.id) AS students
            FROM courses c LEFT JOIN students s ON s.course_id = c.id
            GROUP BY c.id ORDER BY students DESC
            """
        )
        by_status = self._query_all("SELECT status, COUNT(*) AS c FROM students GROUP BY status")
        avg_gpa = self._query_one("SELECT AVG(gpa) AS a FROM students WHERE gpa IS NOT NULL") or {"a": 0}
        fees_by_status = self._query_all("SELECT status, COALESCE(SUM(amount),0) AS total FROM fees GROUP BY status")

        return {
            "enrollmentByCourse": by_course,
            "studentsByStatus": {row["status"]: row["c"] for row in by_status},
            "averageGpa": round(float(avg_gpa["a"] or 0), 2),
            "feesByStatus": {row["status"]: float(row["total"]) for row in fees_by_status},
        }

    # ------------------------------------------------------------------
    # Notifications
    # ------------------------------------------------------------------

    def fetch_notifications(self, type_="", audience="", limit=None):
        query = "SELECT * FROM notifications WHERE 1=1"
        params = []
        if type_:
            query += " AND type=%s"
            params.append(type_)
        if audience:
            query += " AND audience=%s"
            params.append(audience)
        query += " ORDER BY created_at DESC"
        if limit:
            query += " LIMIT %s"
            params.append(int(limit))
        rows = self._query_all(query, params)
        for row in rows:
            row["sentAgo"] = self._time_ago(row.get("created_at"))
        return rows

    def add_notification(self, data):
        row = self._execute(
            """
            INSERT INTO notifications (title, message, type, audience, audience_value, student_id, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
            """,
            (
                data.get("title"), data.get("message"), data.get("type", "info"),
                data.get("audience", "all"), data.get("audienceValue"), data.get("studentId"),
            ),
            return_row_query="SELECT * FROM notifications WHERE id = LAST_INSERT_ID()",
        )
        return row or {"error": "Failed to send notification"}

    def delete_notification(self, notification_id):
        return self._execute("DELETE FROM notifications WHERE id=%s", (notification_id,))

    # ------------------------------------------------------------------
    # Documents
    # ------------------------------------------------------------------

    def fetch_documents(self, status="", type_="", student=""):
        query = """
            SELECT d.*, CONCAT(s.firstName, ' ', s.lastName) AS studentName
            FROM documents d
            LEFT JOIN students s ON s.id = d.student_id
            WHERE 1=1
        """
        params = []
        if status:
            query += " AND d.status=%s"
            params.append(status)
        if type_:
            query += " AND d.doc_type=%s"
            params.append(type_)
        if student:
            query += " AND d.student_id=%s"
            params.append(student)
        query += " ORDER BY d.uploaded_at DESC"
        return self._query_all(query, params)

    def add_document(self, student_id, doc_type, file_name, file_path, mime_type, size_bytes, status):
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

    def update_document(self, document_id, status, review_note=""):
        result = self._execute(
            "UPDATE documents SET status=%s, review_note=%s, reviewed_at=NOW() WHERE id=%s",
            (status, review_note, document_id),
        )
        if result is None:
            return None
        return self._query_one("SELECT * FROM documents WHERE id=%s", (document_id,))

    def delete_document(self, document_id):
        return self._execute("DELETE FROM documents WHERE id=%s", (document_id,))

    def get_document_file(self, document_id):
        return self._query_one(
            "SELECT file_path, mime_type, file_name FROM documents WHERE id=%s", (document_id,)
        )

    # ------------------------------------------------------------------
    # Attendance
    # ------------------------------------------------------------------

    def fetch_attendance(self):
        return self._query_all(
            """
            SELECT a.*, CONCAT(s.firstName, ' ', s.lastName) AS studentName, c.name AS courseName
            FROM attendance a
            LEFT JOIN students s ON s.id = a.student_id
            LEFT JOIN courses c ON c.id = a.course_id
            ORDER BY a.date DESC
            """
        )

    def add_attendance(self, data):
        row = self._execute(
            "INSERT INTO attendance (student_id, course_id, date, status) VALUES (%s, %s, %s, %s)",
            (data.get("studentId"), data.get("courseId"), data.get("date"), data.get("status", "Present")),
            return_row_query="SELECT * FROM attendance WHERE id = LAST_INSERT_ID()",
        )
        return row or {"error": "Failed to record attendance"}

    def delete_attendance(self, record_id):
        return self._execute("DELETE FROM attendance WHERE id=%s", (record_id,))

    # ------------------------------------------------------------------
    # Fees
    # ------------------------------------------------------------------

    def fetch_fees(self):
        return self._query_all(
            """
            SELECT f.*, CONCAT(s.firstName, ' ', s.lastName) AS studentName
            FROM fees f
            LEFT JOIN students s ON s.id = f.student_id
            ORDER BY f.due_date DESC
            """
        )

    def add_fee(self, data):
        row = self._execute(
            "INSERT INTO fees (student_id, amount, due_date, status) VALUES (%s, %s, %s, %s)",
            (data.get("studentId"), data.get("amount"), data.get("dueDate"), data.get("status", "Pending")),
            return_row_query="SELECT * FROM fees WHERE id = LAST_INSERT_ID()",
        )
        return row or {"error": "Failed to add fee record"}

    def delete_fee(self, fee_id):
        return self._execute("DELETE FROM fees WHERE id=%s", (fee_id,))

    # ------------------------------------------------------------------
    # Timetable
    # ------------------------------------------------------------------

    def fetch_timetable(self, course=""):
        query = """
            SELECT t.*, c.name AS courseName
            FROM timetable t
            LEFT JOIN courses c ON c.id = t.course_id
            WHERE 1=1
        """
        params = []
        if course:
            query += " AND t.course_id=%s"
            params.append(course)
        query += " ORDER BY FIELD(t.day,'Mon','Tue','Wed','Thu','Fri','Sat','Sun'), t.start_time"
        return self._query_all(query, params)

    def add_timetable(self, data):
        row = self._execute(
            """
            INSERT INTO timetable (course_id, day, start_time, end_time, subject, room, staff_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                data.get("courseId"), data.get("day"), data.get("startTime"), data.get("endTime"),
                data.get("subject"), data.get("room"), data.get("staffId"),
            ),
            return_row_query="SELECT * FROM timetable WHERE id = LAST_INSERT_ID()",
        )
        return row or {"error": "Failed to add timetable entry"}

    def delete_timetable(self, entry_id):
        return self._execute("DELETE FROM timetable WHERE id=%s", (entry_id,))

    # ------------------------------------------------------------------
    # Calendar events
    # ------------------------------------------------------------------

    def fetch_calendar(self):
        return self._query_all("SELECT * FROM calendar_events ORDER BY event_date")

    def add_calendar_event(self, data):
        row = self._execute(
            "INSERT INTO calendar_events (title, description, event_date, event_type) VALUES (%s, %s, %s, %s)",
            (data.get("title"), data.get("description", ""), data.get("date"), data.get("type", "General")),
            return_row_query="SELECT * FROM calendar_events WHERE id = LAST_INSERT_ID()",
        )
        return row or {"error": "Failed to add calendar event"}

    def delete_calendar_event(self, event_id):
        return self._execute("DELETE FROM calendar_events WHERE id=%s", (event_id,))

    # ------------------------------------------------------------------
    # Messages
    # ------------------------------------------------------------------

    def fetch_message_threads(self):
        rows = self._query_all(
            """
            SELECT student_id, MAX(created_at) AS lastAt,
                   SUBSTRING_INDEX(GROUP_CONCAT(body ORDER BY created_at DESC), ',', 1) AS lastMessage
            FROM messages GROUP BY student_id ORDER BY lastAt DESC
            """
        )
        for row in rows:
            student = self._query_one(
                "SELECT firstName, lastName FROM students WHERE id=%s", (row["student_id"],)
            )
            row["studentName"] = self._student_name(student) if student else "Unknown"
            row["lastAgo"] = self._time_ago(row.pop("lastAt", None))
        return rows

    def add_message(self, student_id, student_name, body, sender):
        row = self._execute(
            "INSERT INTO messages (student_id, student_name, body, sender, created_at) VALUES (%s, %s, %s, %s, NOW())",
            (student_id, student_name, body, sender),
            return_row_query="SELECT * FROM messages WHERE id = LAST_INSERT_ID()",
        )
        return row or {"error": "Failed to send message"}

    # ------------------------------------------------------------------
    # Staff
    # ------------------------------------------------------------------

    def fetch_staff(self):
        return self._query_all("SELECT * FROM staff ORDER BY name")

    def upsert_staff(self, data, staff_id=None):
        if staff_id:
            result = self._execute(
                """
                UPDATE staff SET name=%s, email=%s, phone=%s, designation=%s, department=%s, status=%s
                WHERE id=%s
                """,
                (
                    data.get("name"), data.get("email"), data.get("phone"),
                    data.get("designation"), data.get("department"),
                    data.get("status", "Active"), staff_id,
                ),
            )
            if result is None:
                return {"error": "Failed to update staff member"}
            return self._query_one("SELECT * FROM staff WHERE id=%s", (staff_id,))

        row = self._execute(
            """
            INSERT INTO staff (name, email, phone, designation, department, status)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                data.get("name"), data.get("email"), data.get("phone"),
                data.get("designation"), data.get("department"), data.get("status", "Active"),
            ),
            return_row_query="SELECT * FROM staff WHERE id = LAST_INSERT_ID()",
        )
        return row or {"error": "Failed to add staff member"}

    # ------------------------------------------------------------------
    # Activity log
    # ------------------------------------------------------------------

    def log_activity(self, actor, action, target):
        return self._execute(
            "INSERT INTO activity_log (actor, action, target, created_at) VALUES (%s, %s, %s, NOW())",
            (actor, action, target),
        )

    def fetch_activity_logs(self, limit=50):
        rows = self._query_all(
            "SELECT * FROM activity_log ORDER BY created_at DESC LIMIT %s", (int(limit),)
        )
        for row in rows:
            row["timeAgo"] = self._time_ago(row.pop("created_at", None))
        return rows
