import csv
import io
import os
from werkzeug.utils import secure_filename
from flask import Blueprint, Response, jsonify, request, send_file
from db_helpers import get_collage_db
from Auth.controller import token_required, roles_required

collage_bp = Blueprint('collages', __name__)
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads", "documents")

ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "doc", "docx"}
ALLOWED_MIMETYPES = {
    "application/pdf", "image/png", "image/jpeg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _allowed_file(filename, mimetype):
    ext = filename.rsplit(".", 1)[-1].lower() if filename and "." in filename else ""
    return ext in ALLOWED_EXTENSIONS and mimetype in ALLOWED_MIMETYPES


# ----------------------------------------------------------------------
# FIX (C1): this entire blueprint had zero authentication before — every
# route below is now behind @token_required + @roles_required, restricted
# to college_admin (and super_admin, who should be able to see everything
# via the platform panel too). If your data model is truly multi-tenant
# (one row of `students`/`fees`/etc. per school), you additionally need
# to scope every query in collage_Dash_APIs/model.py by the caller's
# school/org id (request.auth_user should carry that claim) so one
# college_admin can't read another school's data just because both hold
# a valid token — that scoping isn't done here since it depends on your
# schema, but it's the next thing to add.
# ----------------------------------------------------------------------

@collage_bp.route("/stats", methods=["GET"])
@token_required
@roles_required("college_admin", "super_admin")
def get_stats():
    return jsonify(get_collage_db().fetch_dashboard_stats()), 200

@collage_bp.route("/students", methods=["GET"])
@token_required
@roles_required("college_admin", "super_admin")
def get_students():
    obj = get_collage_db()
    rows = obj.fetch_students_data(
        request.args.get("search", ""),
        request.args.get("course", ""),
        request.args.get("status", ""),
    )
    return jsonify(rows), 200

@collage_bp.route("/students/<int:student_id>", methods=["GET"])
@token_required
@roles_required("college_admin", "super_admin")
def get_student(student_id):
    return get_collage_db().fetch_student_data(student_id)

@collage_bp.route("/students", methods=["POST"])
@token_required
@roles_required("college_admin", "super_admin")
def create_student():
    data = request.get_json(silent=True) or {}
    required = ["firstName", "lastName", "email", "course_id"]
    missing = [field for field in required if not data.get(field)]
    if missing:
        return jsonify({"error": f"Missing required field(s): {', '.join(missing)}"}), 400
    return get_collage_db().Add_new_student(data)

@collage_bp.route("/students/<int:student_id>", methods=["PUT"])
@token_required
@roles_required("college_admin", "super_admin")
def update_student(student_id):
    data = request.get_json(silent=True) or {}
    return get_collage_db().update_student(student_id, data)

@collage_bp.route("/students/<int:student_id>", methods=["DELETE"])
@token_required
@roles_required("college_admin", "super_admin")
def delete_student(student_id):
    return get_collage_db().Delete_student(student_id)

@collage_bp.route("/courses", methods=["GET"])
@token_required
@roles_required("college_admin", "super_admin")
def get_courses():
    return jsonify(get_collage_db().fetch_courses_data()), 200

@collage_bp.route("/analytics", methods=["GET"])
@token_required
@roles_required("college_admin", "super_admin")
def get_analytics():
    return jsonify(get_collage_db().fetch_analytics_data()), 200

@collage_bp.route("/export/students.csv", methods=["GET"])
@token_required
@roles_required("college_admin", "super_admin")
def export_students_csv():
    rows = get_collage_db().fetch_students_export()
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "id", "firstName", "lastName", "email", "phone", "dob", "gender",
        "address", "course", "year", "gpa", "status", "notes",
    ])
    writer.writeheader()
    writer.writerows(rows)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=students.csv"},
    )

@collage_bp.route("/notifications", methods=["GET", "POST"])
@token_required
@roles_required("college_admin", "super_admin")
def notifications():
    obj = get_collage_db()
    if request.method == "POST":
        return jsonify(obj.add_notification(request.get_json(silent=True) or {})), 201
    return jsonify(obj.fetch_notifications(
        request.args.get("type", ""),
        request.args.get("audience", ""),
        request.args.get("limit"),
    )), 200

@collage_bp.route("/notifications/<int:notification_id>", methods=["DELETE"])
@token_required
@roles_required("college_admin", "super_admin")
def delete_notification(notification_id):
    get_collage_db().delete_notification(notification_id)
    return jsonify({"message": "Notification deleted"}), 200

@collage_bp.route("/notifications/<int:notification_id>/resend", methods=["POST"])
@token_required
@roles_required("college_admin", "super_admin")
def resend_notification(notification_id):
    return jsonify({"message": "Notification resent", "id": notification_id}), 200

@collage_bp.route("/documents", methods=["GET"])
@token_required
@roles_required("college_admin", "super_admin")
def get_documents():
    return jsonify(get_collage_db().fetch_documents(
        request.args.get("status", ""),
        request.args.get("type", ""),
        request.args.get("student", ""),
    )), 200

@collage_bp.route("/students/<int:student_id>/documents", methods=["GET", "POST"])
@token_required
@roles_required("college_admin", "super_admin")
def student_documents(student_id):
    obj = get_collage_db()
    if request.method == "POST":
        file = request.files.get("file")
        if not file or not file.filename:
            return jsonify({"error": "File is required"}), 400
        # FIX (C4): reject anything that isn't an explicitly allowed
        # document type/extension instead of accepting anything.
        if not _allowed_file(file.filename, file.mimetype):
            return jsonify({"error": "Unsupported file type"}), 400
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        filename = secure_filename(file.filename)
        stored_name = f"{student_id}_{filename}"
        path = os.path.join(UPLOAD_DIR, stored_name)
        file.save(path)
        doc = obj.add_document(
            student_id,
            request.form.get("docType", "Document"),
            filename,
            path,
            file.mimetype or "",
            os.path.getsize(path),
            request.form.get("status", "Pending Review"),
        )
        return jsonify(doc), 201
    return jsonify(obj.fetch_documents(student=str(student_id))), 200

@collage_bp.route("/documents/<int:document_id>", methods=["PATCH", "DELETE"])
@token_required
@roles_required("college_admin", "super_admin")
def document_detail(document_id):
    if request.method == "DELETE":
        get_collage_db().delete_document(document_id)
        return jsonify({"message": "Document deleted"}), 200
    payload = request.get_json(silent=True) or {}
    doc = get_collage_db().update_document(document_id, payload.get("status", "Pending Review"), payload.get("reviewNote", ""))
    if not doc:
        return jsonify({"error": "Document not found"}), 404
    return jsonify(doc), 200

@collage_bp.route("/documents/<int:document_id>/file", methods=["GET"])
@token_required
@roles_required("college_admin", "super_admin")
def document_file(document_id):
    row = get_collage_db().get_document_file(document_id)
    if not row or not row.get("file_path") or not os.path.exists(row["file_path"]):
        return jsonify({"error": "File not found"}), 404
    # FIX (C4): never trust/replay the client-supplied mimetype for
    # rendering, and always force a download instead of inline display —
    # this is what closes the stored-XSS-via-upload path. The browser
    # will save the file rather than execute it in this origin.
    return send_file(
        row["file_path"],
        mimetype="application/octet-stream",
        download_name=row.get("file_name"),
        as_attachment=True,
    )

@collage_bp.route("/attendance", methods=["GET", "POST"])
@token_required
@roles_required("college_admin", "super_admin")
def attendance_records():
    obj = get_collage_db()
    if request.method == "POST":
        return jsonify(obj.add_attendance(request.get_json(silent=True) or {})), 201
    return jsonify(obj.fetch_attendance()), 200

@collage_bp.route("/attendance/<record_id>", methods=["DELETE"])
@token_required
@roles_required("college_admin", "super_admin")
def delete_attendance_record(record_id):
    get_collage_db().delete_attendance(record_id)
    return jsonify({"message": "Attendance record deleted"}), 200

@collage_bp.route("/fees", methods=["GET", "POST"])
@token_required
@roles_required("college_admin", "super_admin")
def fees():
    obj = get_collage_db()
    if request.method == "POST":
        return jsonify(obj.add_fee(request.get_json(silent=True) or {})), 201
    return jsonify(obj.fetch_fees()), 200

@collage_bp.route("/fees/<fee_id>", methods=["DELETE"])
@token_required
@roles_required("college_admin", "super_admin")
def delete_fee(fee_id):
    get_collage_db().delete_fee(fee_id)
    return jsonify({"message": "Fee record deleted"}), 200

@collage_bp.route("/timetable", methods=["GET", "POST"])
@token_required
@roles_required("college_admin", "super_admin")
def timetable():
    obj = get_collage_db()
    if request.method == "POST":
        return jsonify(obj.add_timetable(request.get_json(silent=True) or {})), 201
    return jsonify(obj.fetch_timetable(request.args.get("course", ""))), 200

@collage_bp.route("/timetable/<entry_id>", methods=["DELETE"])
@token_required
@roles_required("college_admin", "super_admin")
def delete_timetable(entry_id):
    get_collage_db().delete_timetable(entry_id)
    return jsonify({"message": "Timetable entry deleted"}), 200

@collage_bp.route("/calendar-events", methods=["GET", "POST"])
@token_required
@roles_required("college_admin", "super_admin")
def calendar_events():
    obj = get_collage_db()
    if request.method == "POST":
        return jsonify(obj.add_calendar_event(request.get_json(silent=True) or {})), 201
    return jsonify(obj.fetch_calendar()), 200

@collage_bp.route("/calendar-events/<event_id>", methods=["DELETE"])
@token_required
@roles_required("college_admin", "super_admin")
def delete_calendar_event(event_id):
    get_collage_db().delete_calendar_event(event_id)
    return jsonify({"message": "Calendar event deleted"}), 200

@collage_bp.route("/messages", methods=["GET"])
@token_required
@roles_required("college_admin", "super_admin")
def messages():
    return jsonify(get_collage_db().fetch_message_threads()), 200

@collage_bp.route("/messages/<student_id>", methods=["POST"])
@token_required
@roles_required("college_admin", "super_admin")
def send_staff_message(student_id):
    data = request.get_json(silent=True) or {}
    student_name = data.get("studentName")
    if not student_name:
        row = get_collage_db()._query_one("SELECT CONCAT(firstName, ' ', lastName) AS name FROM students WHERE id=%s", (student_id,))
        student_name = (row or {}).get("name") or "Student"
    return jsonify(get_collage_db().add_message(student_id, student_name, data.get("body") or data.get("text", ""), "staff")), 201

@collage_bp.route("/staff", methods=["GET", "POST"])
@token_required
@roles_required("college_admin", "super_admin")
def staff():
    obj = get_collage_db()
    if request.method == "POST":
        return jsonify(obj.upsert_staff(request.get_json(silent=True) or {})), 201
    return jsonify(obj.fetch_staff()), 200

@collage_bp.route("/staff/<staff_id>", methods=["PUT"])
@token_required
@roles_required("college_admin", "super_admin")
def update_staff(staff_id):
    return jsonify(get_collage_db().upsert_staff(request.get_json(silent=True) or {}, staff_id)), 200

@collage_bp.route("/activity-log", methods=["GET", "POST"])
@token_required
@roles_required("college_admin", "super_admin")
def activity_log():
    obj = get_collage_db()
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        obj.log_activity(data.get("actor"), data.get("action"), data.get("target"))
        return jsonify({"message": "Activity logged"}), 201
    return jsonify(obj.fetch_activity_logs(request.args.get("limit", 50))), 200
