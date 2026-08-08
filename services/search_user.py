from flask import jsonify, request
from pymysql import connect, cursors
from shared.model import controller
from dotenv import load_dotenv
import os

load_dotenv(".env")
class search_class(controller):
    def __init__(self):
        super().__init__()

    def fetch_user_by_any(self,table_name,col_name, comp_with):
            try:
                sel_query = f"SELECT * FROM {table_name} WHERE {col_name} = %s"
                self.cur.execute(sel_query, (comp_with,))
                result = self.cur.fetchone()
                return result
            except Exception as e:
                print(e)
                return None

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

    def fetch_user_by_token(self, token):
            try:
                sel_query = "SELECT * FROM organization_admins WHERE reset_token = %s"
                self.cur.execute(sel_query, (token,))
                result = self.cur.fetchone()
                return result
            except Exception as e:
                print(e)
                return None
 

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
        

    def Delete_student(self, student_id):
        try:
            del_query="""DELETE FROM students WHERE id = %s"""
            self.cur.execute(del_query, (student_id,))
            self.conn.commit()
            return jsonify({"message": "student deleted successfully"}), 201
        except Exception as e:
            return jsonify({"error":"Failed to delete student"}), 500

 