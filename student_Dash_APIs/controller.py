from flask import Blueprint, jsonify, render_template, request
from db_helpers import get_student_db

student_bp = Blueprint("student", __name__)


@student_bp.route("/student", methods=["GET"])
def students():
    return render_template("student_portal.html")


@student_bp.route("/student_portal.html", methods=["GET"])
def student_portal():
    return render_template("student_portal.html")


def _current_student_id():
    """Resolves which student a /student/me/* request is for.

    NOTE: this app doesn't verify accessTokens anywhere yet (login just
    hands back a static "local-session" string), so there is no way to
    cryptographically tie a request back to a specific logged-in student.
    Until real token verification exists, this can only trust the id the
    client sends — it can no longer silently fall back to "whichever
    student happens to be first in the table" (that was leaking arbitrary
    students' data to anyone who didn't pass an id). Once real auth is
    added, replace this with the student id decoded from the verified
    session/JWT instead of a client-supplied value.
    """
    return request.args.get("student_id") or request.headers.get("X-Student-Id")


def _require_student():
    """Returns (student_id, error_response_or_None)."""
    student_id = _current_student_id()
    if not student_id:
        return None, (jsonify({"error": "student_id is required"}), 401)
    return student_id, None


@student_bp.route("/student/me", methods=["GET"])
def student_me():
    student_id, err = _require_student()
    if err:
        return err
    profile = get_student_db().get_profile(student_id)
    if not profile:
        return jsonify({"error": "Student not found"}), 404
    return jsonify(profile), 200


@student_bp.route("/student/me/courses", methods=["GET"])
def student_courses():
    student_id, err = _require_student()
    if err:
        return err
    return jsonify(get_student_db().get_courses(student_id)), 200


@student_bp.route("/student/me/grades", methods=["GET"])
def student_grades():
    student_id, err = _require_student()
    if err:
        return err
    return jsonify(get_student_db().get_grades(student_id)), 200


@student_bp.route("/student/me/attendance", methods=["GET"])
def student_attendance():
    student_id, err = _require_student()
    if err:
        return err
    return jsonify(get_student_db().get_attendance(student_id)), 200


@student_bp.route("/student/me/fees", methods=["GET"])
def student_fees():
    student_id, err = _require_student()
    if err:
        return err
    return jsonify(get_student_db().get_fees(student_id)), 200


@student_bp.route("/student/me/notices", methods=["GET"])
def student_notices():
    student_id, err = _require_student()
    if err:
        return err
    return jsonify(get_student_db().get_notices(student_id)), 200


@student_bp.route("/student/me/documents", methods=["GET", "POST"])
def student_documents():
    student_id, err = _require_student()
    if err:
        return err
    obj = get_student_db()

    if request.method == "POST":
        import os
        from werkzeug.utils import secure_filename

        file = request.files.get("file")
        if not file:
            return jsonify({"error": "File is required"}), 400

        upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads", "documents")
        os.makedirs(upload_dir, exist_ok=True)
        filename = secure_filename(file.filename or "document")
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
def student_messages():
    student_id, err = _require_student()
    if err:
        return err
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
def student_timetable():
    student_id, err = _require_student()
    if err:
        return err
    return jsonify(get_student_db().get_timetable(student_id)), 200


@student_bp.route("/student/me/calendar", methods=["GET"])
def student_calendar():
    return jsonify(get_student_db().get_calendar()), 200
