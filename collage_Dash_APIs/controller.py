import csv
import io
import os
from werkzeug.utils import secure_filename
from flask import Blueprint, Response, jsonify, request, send_file
from db_helpers import get_main_db

collage_bp = Blueprint('collages', __name__)
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads", "documents")

@collage_bp.route("/stats", methods=["GET"])
def get_stats():
    return jsonify(get_main_db().fetch_dashboard_stats()), 200

@collage_bp.route("/students", methods=["GET"])
def get_students():
    obj = get_main_db()
    rows = obj.fetch_students_data(
        request.args.get("search", ""),
        request.args.get("course", ""),
        request.args.get("status", ""),
    )
    return jsonify(rows), 200

@collage_bp.route("/students/<int:student_id>", methods=["GET"])
def get_student(student_id):
    return get_main_db().fetch_student_data(student_id)

@collage_bp.route("/students", methods=["POST"])
def create_student():
    data = request.get_json(silent=True) or {}
    required = ["firstName", "lastName", "email", "course_id"]
    missing = [field for field in required if not data.get(field)]
    if missing:
        return jsonify({"error": f"Missing required field(s): {', '.join(missing)}"}), 400
    return get_main_db().Add_new_student(data)

@collage_bp.route("/students/<int:student_id>", methods=["PUT"])
def update_student(student_id):
    data = request.get_json(silent=True) or {}
    return get_main_db().update_student(student_id, data)

@collage_bp.route("/students/<int:student_id>", methods=["DELETE"])
def delete_student(student_id):
    return get_main_db().Delete_student(student_id)

@collage_bp.route("/courses", methods=["GET"])
def get_courses():
    return jsonify(get_main_db().fetch_courses_data()), 200

@collage_bp.route("/analytics", methods=["GET"])
def get_analytics():
    return jsonify(get_main_db().fetch_analytics_data()), 200

@collage_bp.route("/export/students.csv", methods=["GET"])
def export_students_csv():
    rows = get_main_db().fetch_students_export()
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
def notifications():
    obj = get_main_db()
    if request.method == "POST":
        return jsonify(obj.add_notification(request.get_json(silent=True) or {})), 201
    return jsonify(obj.fetch_notifications(
        request.args.get("type", ""),
        request.args.get("audience", ""),
        request.args.get("limit"),
    )), 200

@collage_bp.route("/notifications/<int:notification_id>", methods=["DELETE"])
def delete_notification(notification_id):
    get_main_db().delete_notification(notification_id)
    return jsonify({"message": "Notification deleted"}), 200

@collage_bp.route("/notifications/<int:notification_id>/resend", methods=["POST"])
def resend_notification(notification_id):
    return jsonify({"message": "Notification resent", "id": notification_id}), 200

@collage_bp.route("/documents", methods=["GET"])
def get_documents():
    return jsonify(get_main_db().fetch_documents(
        request.args.get("status", ""),
        request.args.get("type", ""),
        request.args.get("student", ""),
    )), 200

@collage_bp.route("/students/<int:student_id>/documents", methods=["GET", "POST"])
def student_documents(student_id):
    obj = get_main_db()
    if request.method == "POST":
        file = request.files.get("file")
        if not file:
            return jsonify({"error": "File is required"}), 400
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        filename = secure_filename(file.filename or "document")
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
def document_detail(document_id):
    if request.method == "DELETE":
        get_main_db().delete_document(document_id)
        return jsonify({"message": "Document deleted"}), 200
    payload = request.get_json(silent=True) or {}
    doc = get_main_db().update_document(document_id, payload.get("status", "Pending Review"), payload.get("reviewNote", ""))
    if not doc:
        return jsonify({"error": "Document not found"}), 404
    return jsonify(doc), 200

@collage_bp.route("/documents/<int:document_id>/file", methods=["GET"])
def document_file(document_id):
    row = get_main_db().get_document_file(document_id)
    if not row or not row.get("file_path") or not os.path.exists(row["file_path"]):
        return jsonify({"error": "File not found"}), 404
    return send_file(row["file_path"], mimetype=row.get("mime_type") or None, download_name=row.get("file_name"))

@collage_bp.route("/attendance", methods=["GET", "POST"])
def attendance_records():
    obj = get_main_db()
    if request.method == "POST":
        return jsonify(obj.add_attendance(request.get_json(silent=True) or {})), 201
    return jsonify(obj.fetch_attendance()), 200

@collage_bp.route("/attendance/<record_id>", methods=["DELETE"])
def delete_attendance_record(record_id):
    get_main_db().delete_attendance(record_id)
    return jsonify({"message": "Attendance record deleted"}), 200

@collage_bp.route("/fees", methods=["GET", "POST"])
def fees():
    obj = get_main_db()
    if request.method == "POST":
        return jsonify(obj.add_fee(request.get_json(silent=True) or {})), 201
    return jsonify(obj.fetch_fees()), 200

@collage_bp.route("/fees/<fee_id>", methods=["DELETE"])
def delete_fee(fee_id):
    get_main_db().delete_fee(fee_id)
    return jsonify({"message": "Fee record deleted"}), 200

@collage_bp.route("/timetable", methods=["GET", "POST"])
def timetable():
    obj = get_main_db()
    if request.method == "POST":
        return jsonify(obj.add_timetable(request.get_json(silent=True) or {})), 201
    return jsonify(obj.fetch_timetable(request.args.get("course", ""))), 200

@collage_bp.route("/timetable/<entry_id>", methods=["DELETE"])
def delete_timetable(entry_id):
    get_main_db().delete_timetable(entry_id)
    return jsonify({"message": "Timetable entry deleted"}), 200

@collage_bp.route("/calendar-events", methods=["GET", "POST"])
def calendar_events():
    obj = get_main_db()
    if request.method == "POST":
        return jsonify(obj.add_calendar_event(request.get_json(silent=True) or {})), 201
    return jsonify(obj.fetch_calendar()), 200

@collage_bp.route("/calendar-events/<event_id>", methods=["DELETE"])
def delete_calendar_event(event_id):
    get_main_db().delete_calendar_event(event_id)
    return jsonify({"message": "Calendar event deleted"}), 200

@collage_bp.route("/messages", methods=["GET"])
def messages():
    return jsonify(get_main_db().fetch_message_threads()), 200

@collage_bp.route("/messages/<student_id>", methods=["POST"])
def send_staff_message(student_id):
    data = request.get_json(silent=True) or {}
    student_name = data.get("studentName")
    if not student_name:
        row = get_main_db()._query_one("SELECT CONCAT(firstName, ' ', lastName) AS name FROM students WHERE id=%s", (student_id,))
        student_name = (row or {}).get("name") or "Student"
    return jsonify(get_main_db().add_message(student_id, student_name, data.get("body") or data.get("text", ""), "staff")), 201

@collage_bp.route("/staff", methods=["GET", "POST"])
def staff():
    obj = get_main_db()
    if request.method == "POST":
        return jsonify(obj.upsert_staff(request.get_json(silent=True) or {})), 201
    return jsonify(obj.fetch_staff()), 200

@collage_bp.route("/staff/<staff_id>", methods=["PUT"])
def update_staff(staff_id):
    return jsonify(get_main_db().upsert_staff(request.get_json(silent=True) or {}, staff_id)), 200

@collage_bp.route("/activity-log", methods=["GET", "POST"])
def activity_log():
    obj = get_main_db()
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        obj.log_activity(data.get("actor"), data.get("action"), data.get("target"))
        return jsonify({"message": "Activity logged"}), 201
    return jsonify(obj.fetch_activity_logs(request.args.get("limit", 50))), 200

