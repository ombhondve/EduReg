from flask import Flask, Response, jsonify, render_template, request
from shared.model import controller
import bcrypt
import jwt
import csv
import io
import datetime
import os
app = Flask(__name__)
obj=controller()
SECRET_KEY = os.getenv("JWT_SECRET")

def require_auth(f):
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing token"}), 401
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            request.user = payload
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return wrapper

@app.route('/', methods=['GET'])
def index():
    return render_template("index.html")

@app.route('/super_admin', methods=['GET'])
def super_admin():
    return render_template("super_admin.html")

@app.route('/student', methods=['GET'])
def students():
    return render_template("student_portal.html")

@app.route('/login_signup', methods=['GET'])
def dashboard():
    return render_template("login_signup.html")

@app.route('/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()
    password = data.get('password')
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    data['password'] = hashed_password
    result = obj.Add_new_user(data)

    if result:
        return jsonify({
            "message": "User added successfully"
        }), 200

    return jsonify({
        "error": "Failed to add user"
    }), 500

@app.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    user = obj.fetch_user_by_email(email)
    if user and bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
        access_token = jwt.encode({
            "id": user['id'], "name": user['name'],
            "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=15),
        }, SECRET_KEY, algorithm="HS256")
        refresh_token = jwt.encode({
            "id": user['id'], "name": user['name'],
            "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7),
        }, SECRET_KEY, algorithm="HS256")

        return jsonify({
            "message": "Login successful",
            "accessToken": access_token,
            "refreshToken": refresh_token,
            "user": {"id": user['id'], "name": user['name'], "email": user['email']}
        }), 200

    return jsonify({"error": "Invalid email or password"}), 401

@app.route('/auth/refresh', methods=['POST'])
def refresh_token():
    data = request.get_json()
    old_refresh_token = data.get('refreshToken')
    if not old_refresh_token:
        return jsonify({"error": "Missing refresh token"}), 401
    try:
        payload = jwt.decode(old_refresh_token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Refresh token expired, please log in again"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid refresh token"}), 401

    new_access_token = jwt.encode({
        "id": payload["id"], "name": payload["name"],
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=15),
    }, SECRET_KEY, algorithm="HS256")
    return jsonify({"accessToken": new_access_token}), 200

@app.route("/collage_system", methods=["GET"])
def student_registration():
    return render_template("collage_system.html")

@app.route("/stats")
def get_stats():
    data = obj.fetch_dashboard_stats()
    for student in data["recent"]:
        course_name = course_codes(student["course_id"])
        student["course"] = course_name
    return jsonify(data)

@app.route('/students', methods=['GET'])
def list_students():
    search = request.args.get('search', '').strip()
    course = request.args.get('course', '').strip()
    course_id = course_codes(course) 
    status = request.args.get('status', '').strip()
    
    data = obj.fetch_students_data(search, course_id, status)
    for courseid in data:
        course_name = course_codes(courseid['course_id'])
        courseid['course'] = course_name
    return jsonify(data)

def course_codes(course_name):
    
    data1=obj.fetch_courses_data()
    for course in data1:
        if course["name"] == course_name :
            
            return course["id"]
        elif course["id"] == course_name:
            
            return course["name"]
        
    return None

@app.route('/students', methods=['POST'])
def create_student():
    data = request.get_json()
    course = data.get('course', '')
    data["course_id"] = course_codes(course)
    data.pop("course", None)
    return obj.Add_new_student(data)  # Assuming Add_new_student is a function that handles adding a new student

@app.route('/students/<int:student_id>', methods=['GET'])
def get_student(student_id):
    return obj.fetch_student_data(student_id)

@app.route('/students/<int:student_id>', methods=['PUT'])
def update_student(student_id):
    try:
        data = request.get_json()
        course = data.get('course', '')
        data["course_id"] = course_codes(course)
        data.pop("course", None)
        print(f"Course id for {data}")
        # Here you would typically update the student in the database
        return obj.update_student(student_id,data)
    except Exception as e:
        return jsonify({"error": "Failed to update student"}), 500

@app.route('/students/<int:student_id>', methods=['DELETE'])
def Delete_student(student_id):
    try:
        print(f"student id is: {student_id}")
        # Here you would typically Delete the student in the database
        return obj.Delete_student(student_id)
    except Exception as e:
        return jsonify({"error": "Failed to Delete student"}), 500
     
@app.route('/courses', methods=['GET'])
def getcourses():
    return obj.fetch_courses_data()

@app.route("/analytics", methods=["GET"])
def get_analytics():

    data = obj.fetch_analytics_data()

    return jsonify(data)

@app.route('/export/students.csv', methods=['GET'])
def export_students_csv():
    try:
        rows = obj.fetch_students_export()
        output = io.StringIO()
        fieldnames = ['id', 'firstName', 'lastName', 'email', 'phone', 'dob',
                      'gender', 'address', 'course', 'year', 'gpa', 'status', 'notes']
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': 'attachment; filename=students.csv'}
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
