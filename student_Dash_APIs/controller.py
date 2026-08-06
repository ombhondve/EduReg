import os

from flask import Blueprint, jsonify, render_template, request
from werkzeug.utils import secure_filename

from db_helpers import get_student_db
from Auth.controller import token_required, roles_required

student_bp = Blueprint("student", __name__)

# FIX (C4): explicit allow-list instead of accepting any file/any type.
ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "doc", "docx"}
ALLOWED_MIMETYPES = {
    "application/pdf", "image/png", "image/jpeg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _allowed_file(filename, mimetype):
    ext = filename.rsplit(".", 1)[-1].lower() if filename and "." in filename else ""
    return ext in ALLOWED_EXTENSIONS and mimetype in ALLOWED_MIMETYPES


@student_bp.route("/student", methods=["GET"])
def students():
    return render_template("student_portal.html")


@student_bp.route("/student_portal.html", methods=["GET"])
def student_portal():
    return render_template("student_portal.html")


# ----------------------------------------------------------------------
# FIX (C1): every /student/me/* route below used to resolve "which
# student" from a client-supplied `student_id` query param or
# `X-Student-Id` header — meaning anyone could read or write ANY
# student's data just by changing that value, with no login required.
#
# Now every route is behind @token_required, and the student id comes
# ONLY from the verified JWT (request.auth_user['id']), never from
# anything the client sends. @roles_required("student") additionally
# stops a college_admin/employee token from being used to hit these
# student-only self-service routes (defense in depth beyond just "is
# there a valid token").
# ----------------------------------------------------------------------

def _student_id_from_token():
    return request.auth_user["id"]


@student_bp.route("/student/me", methods=["GET"])
@token_required
@roles_required("student")
def student_me():
    profile = get_student_db().get_profile(_student_id_from_token())
    if not profile:
        return jsonify({"error": "Student not found"}), 404
    return jsonify(profile), 200


@student_bp.route("/student/me/courses", methods=["GET"])
@token_required
@roles_required("student")
def student_courses():
    return jsonify(get_student_db().get_courses(_student_id_from_token())), 200


@student_bp.route("/student/me/grades", methods=["GET"])
@token_required
@roles_required("student")
def student_grades():
    return jsonify(get_student_db().get_grades(_student_id_from_token())), 200


@student_bp.route("/student/me/attendance", methods=["GET"])
@token_required
@roles_required("student")
def student_attendance():
    return jsonify(get_student_db().get_attendance(_student_id_from_token())), 200


@student_bp.route("/student/me/fees", methods=["GET"])
@token_required
@roles_required("student")
def student_fees():
    return jsonify(get_student_db().get_fees(_student_id_from_token())), 200


@student_bp.route("/student/me/notices", methods=["GET"])
@token_required
@roles_required("student")
def student_notices():
    return jsonify(get_student_db().get_notices(_student_id_from_token())), 200


@student_bp.route("/student/me/documents", methods=["GET", "POST"])
@token_required
@roles_required("student")
def student_documents():
    student_id = _student_id_from_token()
    obj = get_student_db()

    if request.method == "POST":
        file = request.files.get("file")
        if not file or not file.filename:
            return jsonify({"error": "File is required"}), 400
        if not _allowed_file(file.filename, file.mimetype):
            return jsonify({"error": "Unsupported file type"}), 400

        upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads", "documents")
        os.makedirs(upload_dir, exist_ok=True)
        filename = secure_filename(file.filename)
        stored_name = f"{student_id}_{filename}"
        path = os.path.join(upload_dir, stored_name)
        file.save(path)

        doc = obj.add_document(
            student_id,
            request.form.get("docType", "Document"),
            filename,
            path,
            file.mimetype or "",
            os.path.getsize(path),
            "Pending Review",
        )
        return jsonify(doc), 201

    return jsonify(obj.get_documents(student_id)), 200


@student_bp.route("/student/me/messages", methods=["GET", "POST"])
@token_required
@roles_required("student")
def student_messages():
    student_id = _student_id_from_token()
    obj = get_student_db()

    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
        body = payload.get("body", "")
        if not body:
            return jsonify({"error": "Message body is required"}), 400
        profile = obj.get_profile(student_id)
        student_name = (profile or {}).get("name") or "Student"
        return jsonify(obj.add_message(student_id, student_name, body, "student")), 201

    return jsonify(obj.get_messages(student_id)), 200


@student_bp.route("/student/me/timetable", methods=["GET"])
@token_required
@roles_required("student")
def student_timetable():
    return jsonify(get_student_db().get_timetable(_student_id_from_token())), 200


@student_bp.route("/student/me/calendar", methods=["GET"])
@token_required
@roles_required("student")
def student_calendar():
    return jsonify(get_student_db().get_calendar()), 200
