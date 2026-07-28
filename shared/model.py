from flask import jsonify, request
from pymysql import connect, cursors
from dotenv import load_dotenv
import os

load_dotenv("env.env")
class controller:
    def __init__(self):
        try:
            self.conn = connect(
                host=os.getenv("host"), 
                user=os.getenv("user"), 
                password=os.getenv("password"), 
                database=os.getenv("database")
                )
            self.cur = self.conn.cursor(cursors.DictCursor)
        except Exception as e:
            raise
    
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
            sel_query = "SELECT * FROM users WHERE email = %s"
            self.cur.execute(sel_query, (email,))
            result = self.cur.fetchone()
            return result
        except Exception as e:
            print(e)
            return None
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
            self.cur.execute(update_query, (data['firstName'], data['lastName'], data['email'], data['phone'], data['dob'], data['gender'], data['address'], data['year'], data['gpa'], data['status'], data['notes'], data['course_id'], student_id))
            self.conn.commit()
            return jsonify({"message": f"Student {student_id} updated successfully"}), 200
        except Exception as e:
            return jsonify({"error": "Failed to update student"}), 500

    def Add_new_student(self, data):
        try:
            ins_query = "INSERT INTO students (firstName, lastName, email, phone, dob, gender, address,year, gpa, status, notes,course_id) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
            self.cur.execute(ins_query, (data['firstName'], data['lastName'], data['email'], data['phone'], data['dob'], data['gender'], data['address'], data['year'], data['gpa'], data['status'], data['notes'], data['course_id']))
            self.conn.commit()
            return jsonify({"message": "Student added successfully"}), 201
        except Exception as e:
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