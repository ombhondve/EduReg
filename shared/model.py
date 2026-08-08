from flask import jsonify, request
from pymysql import connect, cursors
from dbutils.pooled_db import PooledDB
from dotenv import load_dotenv
import os
import json

load_dotenv(".env")
_CORE_SCHEMA_READY = False
pool = PooledDB(
    creator=__import__("pymysql"),   # the DB driver to use
    maxconnections=10,               # max connections the pool will ever hold
    mincached=2,                     # connections kept ready even when idle
    maxcached=5,                     # max idle connections kept in reserve
    blocking=True,                   # if pool is full, wait instead of erroring
    host=os.getenv("host"),
    user=os.getenv("user"),
    password=os.getenv("password"),
    database=os.getenv("database"),
    cursorclass=cursors.DictCursor,
)

CORE_TABLE_STATEMENTS = [
        """
        CREATE TABLE IF NOT EXISTS organizations (
            organization_id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            subdomain VARCHAR(100) NOT NULL UNIQUE,
            type VARCHAR(50) NOT NULL,
            website VARCHAR(255) DEFAULT NULL,
            address TEXT DEFAULT NULL,
            city VARCHAR(100) DEFAULT NULL,
            country VARCHAR(100) DEFAULT NULL,
            timezone VARCHAR(100) DEFAULT NULL,
            notes TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS organization_admins (
            id INT AUTO_INCREMENT PRIMARY KEY,
            organization_id INT NOT NULL,
            admin_name VARCHAR(150) NOT NULL,
            admin_title VARCHAR(100) DEFAULT NULL,
            admin_email VARCHAR(150) NOT NULL UNIQUE,
            admin_phone VARCHAR(20) DEFAULT NULL,
            reset_token VARCHAR(255) DEFAULT NULL,
            token_expiry DATETIME DEFAULT NULL,
            hashed_password VARCHAR(255) DEFAULT NULL,
            CONSTRAINT fk_org_admins_org
                FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)
                ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS organization_plans (
            plan_id INT AUTO_INCREMENT PRIMARY KEY,
            organization_id INT NOT NULL,
            plan VARCHAR(50) NOT NULL,
            billing_cycle ENUM('Monthly','Quarterly','Yearly') NOT NULL,
            max_students INT DEFAULT 0,
            max_staff INT DEFAULT 0,
            storage_gb INT DEFAULT 0,
            status ENUM('Active','Inactive','Suspended') DEFAULT 'Active',
            notes VARCHAR(255) DEFAULT NULL,
            CONSTRAINT fk_org_plans_org
                FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)
                ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS employees (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            email VARCHAR(150) NOT NULL UNIQUE,
            phone VARCHAR(20) DEFAULT NULL,
            employee_id VARCHAR(30) UNIQUE DEFAULT NULL,
            designation VARCHAR(100) DEFAULT NULL,
            department ENUM('Engineering','Support','Sales','Operations','Finance','HR') NOT NULL,
            employment_type ENUM('Full-time','Part-time','Contractor','Intern') NOT NULL DEFAULT 'Full-time',
            roles JSON NOT NULL,
            pages JSON NOT NULL,
            status ENUM('Invited','Active','Suspended') NOT NULL DEFAULT 'Invited',
            hashed_password VARCHAR(255) DEFAULT NULL,
            reset_token VARCHAR(255) UNIQUE DEFAULT NULL,
            invited_at DATETIME DEFAULT NULL,
            joined_at DATETIME DEFAULT NULL,
            notes TEXT DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            token_expiry VARCHAR(255) DEFAULT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS student_directory (
            email VARCHAR(150) PRIMARY KEY,
            organization_id INT NOT NULL
        )
        """,
    
    ]


class controller:
    def __init__(self):
        self.DB_connections()
    def DB_connections(self):
        global _CORE_SCHEMA_READY
        # Instead of connect(...), check out a connection from the pool.
        self.conn = pool.connection()
        self.cur = self.conn.cursor()
        if not _CORE_SCHEMA_READY:
            self.ensure_core_schema()
            _CORE_SCHEMA_READY = True

    def close(self):
        # Returns the connection to the pool instead of really closing it.
        self.cur.close()
        self.conn.close()


    def ensure_core_schema(self):
    # Central-only tables for the `organization` database. Tenant schema
    # (students, courses, documents, ...) lives in each college's own
    # edureg_org_{organization_id} database — see tenant_provisioning.py.
    # These two lists must never be mixed.
        try:
            for statement in CORE_TABLE_STATEMENTS:
                self.cur.execute(statement)
            self.conn.commit()
        except Exception as e:
            print(f"Error ensuring core schema: {e}")
            self.conn.rollback()

    def _query_all(self, query, params=None):
        self.cur.execute(query, params or [])
        return self.cur.fetchall()

    def _query_one(self, query, params=None):
        self.cur.execute(query, params or [])
        return self.cur.fetchone()

    def _student_name_expr(self):
        return "TRIM(CONCAT(COALESCE(s.firstName,''), ' ', COALESCE(s.lastName,'')))"

    def _document_row(self, row):
        return {
            "id": row.get("id"),
            "studentId": str(row.get("student_id")),
            "studentName": row.get("studentName") or "",
            "docType": row.get("doc_type"),
            "fileName": row.get("file_name"),
            "fileUrl": f"/documents/{row.get('id')}/file" if row.get("file_path") else "",
            "mimeType": row.get("mime_type") or "",
            "sizeBytes": row.get("size_bytes") or 0,
            "status": row.get("status"),
            "uploadedAt": row.get("uploaded_at"),
            "reviewedBy": row.get("reviewed_by"),
            "reviewedAt": row.get("reviewed_at"),
            "reviewNote": row.get("review_note") or "",
        }

    def fetch_documents(self, status="", doc_type="", student=""):
        query = f"""
            SELECT d.*, {self._student_name_expr()} AS studentName
            FROM documents d
            LEFT JOIN students s ON s.id=d.student_id
            WHERE 1=1
        """
        params = []
        if status:
            query += " AND d.status=%s"
            params.append(status)
        if doc_type:
            query += " AND d.doc_type=%s"
            params.append(doc_type)
        if student:
            query += " AND (d.student_id=%s OR s.firstName LIKE %s OR s.lastName LIKE %s)"
            params.extend([student, f"%{student}%", f"%{student}%"])
        query += " ORDER BY d.uploaded_at DESC"
        return [self._document_row(row) for row in self._query_all(query, params)]

    def add_document(self, student_id, doc_type, file_name, file_path="", mime_type="", size_bytes=0, status="Pending Review"):
        self.cur.execute(
            """
            INSERT INTO documents(student_id, doc_type, file_name, file_path, mime_type, size_bytes, status)
            VALUES(%s, %s, %s, %s, %s, %s, %s)
            """,
            (student_id, doc_type, file_name, file_path, mime_type, size_bytes, status),
        )
        self.conn.commit()
        return self.fetch_documents(student=str(student_id))[0]

    def update_document(self, document_id, status, review_note=""):
        self.cur.execute(
            "UPDATE documents SET status=%s, review_note=%s, reviewed_at=NOW() WHERE id=%s",
            (status, review_note, document_id),
        )
        self.conn.commit()
        return next((doc for doc in self.fetch_documents() if int(doc["id"]) == int(document_id)), None)

    def delete_document(self, document_id):
        self.cur.execute("DELETE FROM documents WHERE id=%s", (document_id,))
        self.conn.commit()
        return True

    def get_document_file(self, document_id):
        return self._query_one("SELECT file_path, file_name, mime_type FROM documents WHERE id=%s", (document_id,))

    def fetch_notifications(self, notif_type="", audience="", limit=None):
        query = "SELECT * FROM notifications WHERE 1=1"
        params = []
        if notif_type:
            query += " AND type=%s"
            params.append(notif_type)
        if audience:
            query += " AND audience=%s"
            params.append(audience)
        query += " ORDER BY sent_at DESC"
        if limit:
            query += " LIMIT %s"
            params.append(int(limit))
        rows = self._query_all(query, params)
        return [{
            "id": row["id"],
            "title": row["title"],
            "message": row.get("message") or "",
            "type": row.get("type") or "general",
            "audience": row.get("audience") or "all",
            "audienceValue": row.get("audience_value"),
            "studentId": row.get("student_id"),
            "recipientCount": row.get("recipient_count") or 0,
            "sentAt": row.get("sent_at"),
        } for row in rows]

    def add_notification(self, data):
        recipient_count = self._notification_recipient_count(data)
        self.cur.execute(
            """
            INSERT INTO notifications(title, message, type, audience, audience_value, student_id, recipient_count)
            VALUES(%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                data.get("title"), data.get("message"), data.get("type", "general"),
                data.get("audience", "all"), data.get("audienceValue"),
                data.get("studentId"), recipient_count,
            ),
        )
        self.conn.commit()
        return self.fetch_notifications(limit=1)[0]

    def _notification_recipient_count(self, data):
        audience = data.get("audience", "all")
        if audience == "student" and data.get("studentId"):
            return 1
        if audience == "course" and data.get("audienceValue"):
            row = self._query_one(
                """
                SELECT COUNT(*) AS total FROM students s
                JOIN courses c ON c.id=s.course_id
                WHERE c.name=%s OR c.id=%s
                """,
                (data.get("audienceValue"), data.get("audienceValue")),
            )
        elif audience == "status" and data.get("audienceValue"):
            row = self._query_one("SELECT COUNT(*) AS total FROM students WHERE status=%s", (data.get("audienceValue"),))
        else:
            row = self._query_one("SELECT COUNT(*) AS total FROM students")
        return int((row or {}).get("total") or 0)

    def delete_notification(self, notification_id):
        self.cur.execute("DELETE FROM notifications WHERE id=%s", (notification_id,))
        self.conn.commit()
        return True

    def fetch_attendance(self):
        return [{
            "id": f"ATT-{row['id']}",
            "date": str(row["record_date"]),
            "course": row["course"],
            "present": row["present"],
            "absent": row["absent"],
            "late": row["late"],
            "presentPct": row["present_pct"],
        } for row in self._query_all("SELECT * FROM attendance_records ORDER BY record_date DESC, id DESC")]

    def add_attendance(self, data):
        self.cur.execute(
            """
            INSERT INTO attendance_records(course, record_date, present, absent, late, present_pct)
            VALUES(%s, %s, %s, %s, %s, %s)
            """,
            (data.get("course"), data.get("date"), data.get("present", 0), data.get("absent", 0), data.get("late", 0), data.get("presentPct", 0)),
        )
        self.conn.commit()
        return self.fetch_attendance()[0]

    def delete_attendance(self, record_id):
        self.cur.execute("DELETE FROM attendance_records WHERE id=%s", (str(record_id).replace("ATT-", ""),))
        self.conn.commit()
        return True

    def fetch_fees(self):
        return [{
            "id": f"FEE-{row['id']}",
            "studentId": str(row.get("student_id") or ""),
            "studentName": row["student_name"],
            "feeType": row["fee_type"],
            "amount": float(row["amount"] or 0),
            "status": row["status"],
            "dueDate": str(row["due_date"]) if row.get("due_date") else "",
            "notes": row.get("notes") or "",
        } for row in self._query_all("SELECT * FROM fee_records ORDER BY created_at DESC, id DESC")]

    def add_fee(self, data):
        self.cur.execute(
            """
            INSERT INTO fee_records(student_id, student_name, fee_type, amount, status, due_date, notes)
            VALUES(%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                data.get("studentId") or None, data.get("studentName"), data.get("feeType"),
                data.get("amount", 0), data.get("status", "Pending"), data.get("dueDate") or None,
                data.get("notes"),
            ),
        )
        self.conn.commit()
        return self.fetch_fees()[0]

    def delete_fee(self, fee_id):
        self.cur.execute("DELETE FROM fee_records WHERE id=%s", (str(fee_id).replace("FEE-", ""),))
        self.conn.commit()
        return True

    def fetch_timetable(self, course=""):
        query = "SELECT * FROM timetable_entries WHERE 1=1"
        params = []
        if course:
            query += " AND course=%s"
            params.append(course)
        query += " ORDER BY FIELD(day,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'), start_time"
        return [{
            "id": f"TT-{row['id']}",
            "course": row["course"],
            "day": row["day"],
            "start": str(row["start_time"])[:5],
            "end": str(row["end_time"])[:5],
            "subject": row["subject"],
            "room": row.get("room") or "",
            "faculty": row.get("faculty") or "",
        } for row in self._query_all(query, params)]

    def add_timetable(self, data):
        self.cur.execute(
            """
            INSERT INTO timetable_entries(course, day, start_time, end_time, subject, room, faculty)
            VALUES(%s, %s, %s, %s, %s, %s, %s)
            """,
            (data.get("course"), data.get("day"), data.get("start"), data.get("end"), data.get("subject"), data.get("room"), data.get("faculty")),
        )
        self.conn.commit()
        return self.fetch_timetable()[0]

    def delete_timetable(self, entry_id):
        self.cur.execute("DELETE FROM timetable_entries WHERE id=%s", (str(entry_id).replace("TT-", ""),))
        self.conn.commit()
        return True

    def fetch_calendar(self):
        return [{
            "id": f"EV-{row['id']}",
            "title": row["title"],
            "date": str(row["event_date"]),
            "category": row["category"],
            "description": row.get("description") or "",
        } for row in self._query_all("SELECT * FROM calendar_events ORDER BY event_date, id")]

    def add_calendar_event(self, data):
        self.cur.execute(
            "INSERT INTO calendar_events(title, event_date, category, description) VALUES(%s, %s, %s, %s)",
            (data.get("title"), data.get("date"), data.get("category", "Event"), data.get("description")),
        )
        self.conn.commit()
        return self.fetch_calendar()[-1]

    def delete_calendar_event(self, event_id):
        self.cur.execute("DELETE FROM calendar_events WHERE id=%s", (str(event_id).replace("EV-", ""),))
        self.conn.commit()
        return True

    def fetch_message_threads(self):
        rows = self._query_all("SELECT * FROM messages ORDER BY created_at ASC, id ASC")
        threads = {}
        for row in rows:
            sid = str(row.get("student_id") or "")
            if sid not in threads:
                threads[sid] = {"studentId": sid, "studentName": row["student_name"], "messages": []}
            threads[sid]["messages"].append({
                "id": row["id"],
                "from": "staff" if row["sender"] == "staff" else "student",
                "sender": row["sender"],
                "text": row["body"],
                "body": row["body"],
                "time": row["created_at"],
            })
        return list(reversed(list(threads.values())))

    def add_message(self, student_id, student_name, body, sender="staff"):
        self.cur.execute(
            "INSERT INTO messages(student_id, student_name, sender, body) VALUES(%s, %s, %s, %s)",
            (student_id or None, student_name, sender, body),
        )
        self.conn.commit()
        return {"message": "Message sent", "id": self.cur.lastrowid}

    def fetch_staff(self):
        rows = self._query_all("SELECT * FROM staff_roles ORDER BY created_at DESC")
        return [{
            "id": f"STF-{row['id']}",
            "name": row["name"],
            "email": row["email"],
            "role": row["role"],
            "status": row["status"],
            "permissions": json.loads(row["permissions"] or "[]"),
        } for row in rows]

    def upsert_staff(self, data, staff_id=None):
        permissions = json.dumps(data.get("permissions", []))
        if staff_id:
            self.cur.execute(
                "UPDATE staff_roles SET name=%s,email=%s,role=%s,status=%s,permissions=%s WHERE id=%s",
                (data.get("name"), data.get("email"), data.get("role"), data.get("status", "Active"), permissions, str(staff_id).replace("STF-", "")),
            )
        else:
            self.cur.execute(
                "INSERT INTO staff_roles(name,email,role,status,permissions) VALUES(%s,%s,%s,%s,%s)",
                (data.get("name"), data.get("email"), data.get("role"), data.get("status", "Active"), permissions),
            )
        self.conn.commit()
        return self.fetch_staff()[0]

    def log_activity(self, actor, action, target=""):
        self.cur.execute(
            "INSERT INTO activity_logs(actor, action, target) VALUES(%s, %s, %s)",
            (actor or "Staff", action, target),
        )
        self.conn.commit()
        return True

    def fetch_activity_logs(self, limit=50):
        rows = self._query_all("SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT %s", (int(limit),))
        return [{
            "id": f"LOG-{row['id']}",
            "actor": row["actor"],
            "action": row["action"],
            "target": row.get("target") or "",
            "time": row["created_at"],
        } for row in rows]

    def Add_new_user(self, data):
        try:
            ins_query = """
            INSERT INTO users(name, email, password)
            VALUES (%s, %s, %s)
            """
            self.cur.execute(ins_query,
                            (data['name'],
                            data['email'],
                            data['password']))
            self.conn.commit()
            return True

        except Exception as e:
            print(e)
            return False
    def fetch_user_by_email(self, email):
        try:
            sel_query = "SELECT * FROM organization_admins WHERE admin_email = %s"
            self.cur.execute(sel_query, (email,))
            result = self.cur.fetchone()
            return result
        except Exception as e:
            print(e)
            return None
    def fetch_user_by_token(self, table_name, token):
            try:
                sel_query = f"SELECT * FROM {table_name} WHERE reset_token = %s"
                self.cur.execute(sel_query, (token,))
                result = self.cur.fetchone()
                return result
            except Exception as e:
                print(e)
                return None

    def set_password(self,table_name, hash_pass, id):
        try:
            upd_query = f"""
                UPDATE {table_name}
                SET hashed_password = %s, reset_token = NULL, token_expiry = NULL
                WHERE id = %s
            """
            self.cur.execute(upd_query, (hash_pass, id))
            self.conn.commit()
            return True

        except Exception as e:
            print(e)
            self.conn.rollback()
            return False
    def changes_status(self, table_name, status, id):
        try:
            updete_st_query=f"""
                UPDATE {table_name}
                SET status = %s
                WHERE id = %s
            """
            self.cur.execute(updete_st_query, (status, id))
            self.conn.commit()
            return True
        except Exception as e:
            print(e)
            self.conn.rollback()
            return False

    def fetch_dashboard_stats(self):
        try:
            # Overall counts + average GPA in one query
            self.cur.execute("""
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active,
                    SUM(CASE WHEN status = 'Inactive' THEN 1 ELSE 0 END) AS inactive,
                    SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending,
                    SUM(CASE WHEN status = 'Graduated' THEN 1 ELSE 0 END) AS graduated,
                    AVG(gpa) AS avgGpa
                FROM students
            """)
            counts = self.cur.fetchone()

            # Breakdown for the "By Status" chart
            self.cur.execute("""
                SELECT status, COUNT(*) AS cnt
                FROM students
                GROUP BY status
            """)
            by_status = self.cur.fetchall()

            # 5 most recently added students (ordered by id since there's no created_at column)
            self.cur.execute("""
                SELECT id, firstName, lastName, course_id, gpa, status
                FROM students
                ORDER BY id DESC
                LIMIT 5
            """)
            recent = self.cur.fetchall()

            return {
                "total": counts["total"] or 0,
                "active": counts["active"] or 0,
                "inactive": counts["inactive"] or 0,
                "pending": counts["pending"] or 0,
                "graduated": counts["graduated"] or 0,
                "avgGpa": round(counts["avgGpa"], 2) if counts["avgGpa"] is not None else 0,
                "byStatus": by_status,
                "recent": recent,
            }
        except Exception as e:
            print(f"Error fetching dashboard stats: {e}")
            return {
                "total": 0,
                "active": 0,
                "inactive": 0,
                "pending": 0,
                "graduated": 0,
                "avgGpa": 0,
                "byStatus": [],
                "recent": [],
            }   
    

    def fetch_students_data(self, search='', course='', status=''):
        try:
            query = "SELECT * FROM students WHERE 1=1"
            params = []

            if search:
                query += " AND (firstName LIKE %s OR lastName LIKE %s OR email LIKE %s)"
                like_term = f"%{search}%"
                params.extend([like_term, like_term, like_term])

            if course:
                query += " AND course_id = %s"
                params.append(course)

            if status:
                query += " AND status = %s"
                params.append(status)

            self.cur.execute(query, params)
            result = self.cur.fetchall()
            return result
        except Exception as e:
            print(f"Error fetching data: {e}")
            return []

    def fetch_student_data(self, student_id):
        try:
            sel_query="""SELECT * FROM students WHERE id = %s"""
            self.cur.execute(sel_query, (student_id,))
            result = self.cur.fetchone()
            if result:
                return jsonify(result)
            else:
                return jsonify({"error": "Student not found"}), 404
        except Exception as e:
            return jsonify({"error": "Failed to fetch student data"}), 500
        
    def update_student(self, student_id, data):
        try:
            update_query = """
                UPDATE students 
                SET firstName=%s, lastName=%s, email=%s, phone =%s, dob=%s, gender=%s, address=%s, year=%s, gpa=%s, status=%s, notes=%s, course_id=%s
                WHERE id=%s  """
            self.cur.execute(update_query, (
                data.get('firstName'), data.get('lastName'), data.get('email'),
                data.get('phone'), data.get('dob'), data.get('gender'),
                data.get('address'), data.get('year'), data.get('gpa'),
                data.get('status', 'Active'), data.get('notes'),
                data.get('course_id') or data.get('courseId'), student_id,
            ))
            self.conn.commit()
            return jsonify({"message": f"Student {student_id} updated successfully"}), 200
        except Exception as e:
            print(e)
            return jsonify({"error": "Failed to update student"}), 500

    def Add_new_student(self, data):
        try:
            ins_query = "INSERT INTO students (firstName, lastName, email, phone, dob, gender, address,year, gpa, status, notes,course_id) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
            self.cur.execute(ins_query, (
                data.get('firstName'), data.get('lastName'), data.get('email'),
                data.get('phone'), data.get('dob'), data.get('gender'),
                data.get('address'), data.get('year'), data.get('gpa'),
                data.get('status', 'Active'), data.get('notes'),
                data.get('course_id') or data.get('courseId'),
            ))
            self.conn.commit()
            return jsonify({"message": "Student added successfully", "id": self.cur.lastrowid}), 201
        except Exception as e:
            print(e)
            return jsonify({"error": "Failed to add student"}), 500

    def Delete_student(self, student_id):
        try:
            del_query="""DELETE FROM students WHERE id = %s"""
            self.cur.execute(del_query, (student_id,))
            self.conn.commit()
            return jsonify({"message": "student deleted successfully"}), 201
        except Exception as e:
            return jsonify({"error":"Failed to delete student"}), 500

    def fetch_courses_data(self):
        try:
            query = """
            SELECT
                c.id,
                c.name,
                c.course_code,
                c.duration,
                c.status,
                COUNT(s.id) AS studentCount,
                SUM(CASE WHEN s.status = 'Active' THEN 1 ELSE 0 END) AS activeCount,
                ROUND(AVG(s.gpa), 2) AS avgGpa
            FROM courses c
            LEFT JOIN students s
                ON c.id = s.course_id
            GROUP BY
                c.id,
                c.name,
                c.course_code,
                c.duration,
                c.status
            ORDER BY c.id;
            """

            self.cur.execute(query)
            result = self.cur.fetchall()

            return result

        except Exception as e:
            print(f"Error fetching courses: {e}")
            return []
        
    def fetch_analytics_data(self):
        try:
            stats = {}

            # Total students
            self.cur.execute("SELECT COUNT(*) AS total FROM students")
            stats["total"] = self.cur.fetchone()["total"]

            # Average GPA
            self.cur.execute("SELECT ROUND(AVG(gpa),2) AS avgGpa FROM students")
            stats["avgGpa"] = self.cur.fetchone()["avgGpa"]

            # Highest GPA
            self.cur.execute("SELECT MAX(gpa) AS maxGpa FROM students")
            stats["maxGpa"] = self.cur.fetchone()["maxGpa"]

            # Total Courses
            self.cur.execute("SELECT COUNT(*) AS totalCourses FROM courses")
            stats["totalCourses"] = self.cur.fetchone()["totalCourses"]

            # Students by Status
            self.cur.execute("""
                SELECT status, COUNT(*) AS cnt
                FROM students
                GROUP BY status
            """)
            stats["byStatus"] = self.cur.fetchall()

            # Students by Gender
            self.cur.execute("""
                SELECT gender, COUNT(*) AS cnt
                FROM students
                GROUP BY gender
            """)
            stats["byGender"] = self.cur.fetchall()

            # Students by Year
            self.cur.execute("""
                SELECT year, COUNT(*) AS cnt
                FROM students
                GROUP BY year
                ORDER BY year
            """)
            stats["byYear"] = self.cur.fetchall()

            # GPA Distribution
            self.cur.execute("""
                SELECT
                    CASE
                        WHEN gpa < 5 THEN '0-5'
                        WHEN gpa < 6 THEN '5-6'
                        WHEN gpa < 7 THEN '6-7'
                        WHEN gpa < 8 THEN '7-8'
                        WHEN gpa < 9 THEN '8-9'
                        ELSE '9-10'
                    END AS gpaRange,
                    COUNT(*) AS cnt
                FROM students
                WHERE gpa IS NOT NULL
                GROUP BY gpaRange
            """)

            rows = self.cur.fetchall()

            stats["gpaDistribution"] = {
                "0-5":0,
                "5-6":0,
                "6-7":0,
                "7-8":0,
                "8-9":0,
                "9-10":0
            }

            for row in rows:
                stats["gpaDistribution"][row["gpaRange"]] = row["cnt"]

            # Top Performer
            self.cur.execute("""
                SELECT
                    s.id,
                    s.firstName,
                    s.lastName,
                    s.gpa,
                    c.name AS course
                FROM students s
                JOIN courses c
                    ON s.course_id = c.id
                ORDER BY s.gpa DESC
                LIMIT 1
            """)

            stats["topPerformer"] = self.cur.fetchone()

            return stats

        except Exception as e:
            print(e)
            return {}
        
    def fetch_students_export(self):
        try:
            query = """
                SELECT s.id, s.firstName, s.lastName, s.email, s.phone, s.dob,
                    s.gender, s.address, c.name AS course, s.year, s.gpa,
                    s.status, s.notes
                FROM students s
                LEFT JOIN courses c ON s.course_id = c.id
                ORDER BY s.id
            """
            self.cur.execute(query)
            return self.cur.fetchall()
        except Exception as e:
            print(f"Error fetching export data: {e}")
            return []