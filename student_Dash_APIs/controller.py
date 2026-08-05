from flask import Blueprint, jsonify, render_template, request
from db_helpers import get_main_db

student_bp = Blueprint("student", __name__)

_student_documents = []
_student_messages = []


@student_bp.route("/student", methods=["GET"])
def students():
    return render_template("student_portal.html")


@student_bp.route("/student_portal.html", methods=["GET"])
def student_portal():
    return render_template("student_portal.html")


def _current_student():
    obj = get_main_db()
    student_id = request.args.get("student_id") or request.headers.get("X-Student-Id")
    try:
        if student_id:
            obj.cur.execute("SELECT * FROM students WHERE id=%s", (student_id,))
        else:
            obj.cur.execute("SELECT * FROM students ORDER BY id LIMIT 1")
        student = obj.cur.fetchone()
        if not student:
            return None
        obj.cur.execute("SELECT * FROM courses WHERE id=%s", (student.get("course_id"),))
        course = obj.cur.fetchone() or {}
        student["name"] = f"{student.get('firstName', '')} {student.get('lastName', '')}".strip()
        student["course"] = course.get("name", "")
        student["courseCode"] = course.get("course_code", "")
        return student
    except Exception as e:
        print(e)
        return None


@student_bp.route("/student/me", methods=["GET"])
def student_me():
    student = _current_student()
    if not student:
        return jsonify({
            "id": None,
            "name": "Student",
            "email": "",
            "status": "Active",
            "course": "",
            "courseCode": "",
            "gpa": 0,
        }), 200
    return jsonify(student), 200


@student_bp.route("/student/me/courses", methods=["GET"])
def student_courses():
    student = _current_student()
    if not student:
        return jsonify([]), 200
    return jsonify([{
        "id": student.get("course_id"),
        "name": student.get("course"),
        "courseCode": student.get("courseCode"),
        "year": student.get("year"),
        "status": student.get("status"),
    }]), 200


@student_bp.route("/student/me/grades", methods=["GET"])
def student_grades():
    student = _current_student()
    return jsonify([{
        "course": student.get("course") if student else "",
        "term": student.get("year") if student else "",
        "grade": student.get("gpa") if student else 0,
        "status": "Published",
    }]), 200


@student_bp.route("/student/me/attendance", methods=["GET"])
def student_attendance():
    return jsonify({
        "overall": 0,
        "byCourse": [],
        "recent": [],
    }), 200


@student_bp.route("/student/me/fees", methods=["GET"])
def student_fees():
    return jsonify({
        "status": "No dues recorded",
        "totalDue": 0,
        "totalPaid": 0,
        "history": [],
    }), 200


@student_bp.route("/student/me/notices", methods=["GET"])
def student_notices():
    return jsonify([]), 200


@student_bp.route("/student/me/documents", methods=["GET", "POST"])
def student_documents():
    if request.method == "POST":
        file = request.files.get("file")
        doc = {
            "id": len(_student_documents) + 1,
            "docType": request.form.get("docType", "Document"),
            "fileName": file.filename if file else "uploaded-file",
            "status": "Pending Review",
            "uploadedAt": "just now",
            "reviewNote": "",
        }
        _student_documents.insert(0, doc)
        return jsonify(doc), 201
    return jsonify(_student_documents), 200


@student_bp.route("/student/me/messages", methods=["GET", "POST"])
def student_messages():
    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
        msg = {
            "id": len(_student_messages) + 1,
            "sender": "student",
            "body": payload.get("body", ""),
            "time": "just now",
        }
        _student_messages.append(msg)
        return jsonify(msg), 201
    return jsonify(_student_messages), 200


@student_bp.route("/student/me/timetable", methods=["GET"])
def student_timetable():
    return jsonify([]), 200


@student_bp.route("/student/me/calendar", methods=["GET"])
def student_calendar():
    return jsonify([]), 200
