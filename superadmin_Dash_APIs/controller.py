import threading
from flask import Response, jsonify, render_template, request, Blueprint
from db_helpers import get_superadmin_db, get_main_db, get_search_db
import os
import secrets
from datetime import datetime, timedelta
from services.email_service import send_mail
from Auth.controller import token_required, roles_required


superadmin_bp = Blueprint('superadmin', __name__)

SECRET_KEY = os.getenv("JWT_SECRET")

# ----------------------------------------------------------------------
# FIX (C1): this was the most exposed blueprint in the app — every route,
# including create/suspend/delete school, create/delete employees, view
# students across every tenant, and impersonate a school (!), had zero
# authentication. Everything below now requires a valid super_admin
# token. If you have finer-grained employee permissions (the `pages`
# claim from admin_login), add a per-route check like:
#
#   if "schools" not in request.auth_user.get("pages", []):
#       return jsonify({"error": "Forbidden"}), 403
#
# for the sections a given employee role shouldn't reach.
# ----------------------------------------------------------------------

@superadmin_bp.route("/superadmin/stats", methods=["GET"])
@token_required
@roles_required("super_admin")
def get_stats():
    obj_sup = get_superadmin_db()
    data = obj_sup.get_stats()
    if data is None:
        return jsonify({"error": "Failed to fetch stats"}), 500
    return jsonify(data), 200

@superadmin_bp.route("/superadmin/schools", methods=["GET"])
@token_required
@roles_required("super_admin")
def retrieve_schools():
    obj_sup = get_superadmin_db()
    search = request.args.get("search", "")
    plan = request.args.get("plan", "")
    status = request.args.get("status", "")

    data = obj_sup.get_schools(search, plan, status)
    if data is None:
        return jsonify({"error": "Failed to fetch schools"}), 500
    return jsonify(data), 200

@superadmin_bp.route("/superadmin/schools", methods=["POST"])
@token_required
@roles_required("super_admin")
def add_school():
    obj_sup = get_superadmin_db()
    data = request.get_json(silent=True) or {}
    required = ["name", "subdomain", "adminEmail"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing required field(s): {', '.join(missing)}"}), 400

    data['reset_token'] = secrets.token_urlsafe(64)
    data['token_expiry'] = (datetime.now() + timedelta(minutes=30))

    # add_school_org creates the organization row AND provisions that
    # college's own dedicated database (edureg_org_{organization_id}) with
    # every required table. The database name is derived from the real
    # organization_id assigned on insert, not guessed from the school name.
    status = obj_sup.add_school_org(data)
    if status is True:
        mail_sent = sending_mail_set_pass(data.get('adminEmail'), data.get('adminName'), data.get('reset_token'))
        return jsonify({
            "message": "School added successfully",
            "mail_sent": mail_sent,
            "organizationId": data.get('organization_id'),
            "dbName": data.get('db_name'),
        }), 201
    else:
        return jsonify({"error": "Failed to add school organization"}), 500

@superadmin_bp.route("/superadmin/schools/<int:school_id>", methods=["GET"])
@token_required
@roles_required("super_admin")
def retrieve_school(school_id):
    obj_sup = get_superadmin_db()
    data = obj_sup.get_school(school_id)
    if not data:
        return jsonify({"error": "School not found"}), 404
    return jsonify(data), 200

@superadmin_bp.route("/superadmin/schools/<int:school_id>", methods=["PUT"])
@token_required
@roles_required("super_admin")
def update_school(school_id):
    obj_sup = get_superadmin_db()
    data = request.get_json(silent=True) or {}
    updated = obj_sup.update_school(school_id, data)
    if not updated:
        return jsonify({"error": "Failed to update school"}), 500
    return jsonify(updated), 200

@superadmin_bp.route("/superadmin/schools/<int:school_id>/suspend", methods=["POST"])
@token_required
@roles_required("super_admin")
def suspend_school(school_id):
    updated = get_superadmin_db().set_school_status(school_id, "Suspended")
    if not updated:
        return jsonify({"error": "Failed to suspend school"}), 500
    return jsonify(updated), 200

@superadmin_bp.route("/superadmin/schools/<int:school_id>/activate", methods=["POST"])
@token_required
@roles_required("super_admin")
def activate_school(school_id):
    updated = get_superadmin_db().set_school_status(school_id, "Active")
    if not updated:
        return jsonify({"error": "Failed to activate school"}), 500
    return jsonify(updated), 200

@superadmin_bp.route("/superadmin/schools/<int:school_id>", methods=["DELETE"])
@token_required
@roles_required("super_admin")
def delete_school(school_id):
    ok = get_superadmin_db().delete_school(school_id)
    if not ok:
        return jsonify({"error": "Failed to delete school"}), 500
    return jsonify({"message": "School deleted successfully"}), 200

@superadmin_bp.route("/superadmin/schools/<int:school_id>/admins", methods=["GET"])
@token_required
@roles_required("super_admin")
def retrieve_school_admins(school_id):
    admins = get_superadmin_db().get_school_admins(school_id)
    if admins is None:
        return jsonify({"error": "Failed to fetch school admins"}), 500
    return jsonify(admins), 200

@superadmin_bp.route("/superadmin/schools/<int:school_id>/resend-invite", methods=["POST"])
@token_required
@roles_required("super_admin")
def resend_school_invite(school_id):
    obj_sup = get_superadmin_db()
    token = secrets.token_urlsafe(64)
    expiry = datetime.now() + timedelta(minutes=30)
    school = obj_sup.reset_school_admin_invite(school_id, token, expiry)
    if not school:
        return jsonify({"error": "Failed to reset invite"}), 500
    mail_sent = sending_mail_set_pass(school.get("adminEmail"), school.get("adminName"), token)
    return jsonify({"message": "Invite regenerated", "mail_sent": mail_sent}), 200

@superadmin_bp.route("/superadmin/schools/<int:school_id>/impersonate", methods=["POST"])
@token_required
@roles_required("super_admin")
def impersonate_school(school_id):
    school = get_superadmin_db().get_school(school_id)
    if not school:
        return jsonify({"error": "School not found"}), 404
    data = request.get_json(silent=True) or {}
    # FIX: log the ACTUAL authenticated caller (from the verified token),
    # not a client-supplied "adminName" string that could say anything.
    caller_name = request.auth_user.get("name") or request.auth_user.get("email") or "Unknown employee"
    reason = data.get("reason", "Support session")
    get_superadmin_db().log_impersonation(caller_name, school_id, reason)
    # NOTE: this issues a random opaque string, not a real JWT — it won't
    # pass token_required anywhere. If impersonation needs to actually
    # work, issue a real short-lived access token scoped to that school's
    # admin role instead, and log it with the same rigor as a real login.
    return jsonify({
        "message": "Impersonation session prepared",
        "schoolId": school_id,
        "schoolName": school.get("name"),
        "accessToken": secrets.token_urlsafe(32),
    }), 200

def sending_mail_set_pass(to_email, user_name, token):
    link = f"http://127.0.0.1:5000/set-password?type=col-admin&token={token}"

    subject = "Welcome to EduReg - Set Your Password"

    body = f"""
    <html>
        <body>
            <h2>Hello {user_name},</h2>

            <p>Your EduReg account has been created successfully.</p>

            <p>Please click the button below to set your password.</p>

            <p>
                <a href="{link}"
                   style="background:#2563eb;
                          color:white;
                          padding:12px 25px;
                          text-decoration:none;
                          border-radius:5px;">
                    Set Password
                </a>
            </p>

            <p>This link will expire in <strong>30 minutes</strong>.</p>

            <p>If you did not expect this email, you can safely ignore it.</p>

            <br>
            <p>Regards,<br><strong>EduReg Team</strong></p>
        </body>
    </html>
    """

    mail_sent = send_mail(to_email, subject, body)

    if mail_sent:
        return True
    else:
        return False

@superadmin_bp.route("/superadmin/employees", methods=["GET"])
@token_required
@roles_required("super_admin")
def retrieve_employees():
    obj_sup = get_superadmin_db()
    data = obj_sup.get_employees(
        request.args.get("search", ""),
        request.args.get("department", ""),
        request.args.get("role", ""),
        request.args.get("status", ""),
    )
    if data is None:
        return jsonify({"error": "Failed to fetch employees"}), 500
    return jsonify(data), 200

@superadmin_bp.route("/superadmin/employees", methods=["POST"])
@token_required
@roles_required("super_admin")
def add_employee():
    obj_sup = get_superadmin_db()
    data = request.get_json(silent=True) or {}

    required = ["name", "email", "roles", "pages", "phone", "designation", "department", "employmentType", "status"]
    data['invite_token'] = secrets.token_urlsafe(64)
    data['token_expiry'] = (datetime.now() + timedelta(minutes=30))
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing required field(s): {', '.join(missing)}"}), 400

    status = obj_sup.add_employee(data)
    if status is True:
        threading.Thread(
            target=sending_mail_invite,
            args=(data.get('email'), data.get('name'), data.get('invite_token')),
            daemon=True,
        ).start()
        return jsonify({"message": "Employee added successfully", "mail_sent": "pending"}), 201
    else:
        return jsonify({"error": "Failed to add employee"}), 500

@superadmin_bp.route("/superadmin/employees/<int:employee_id>", methods=["GET"])
@token_required
@roles_required("super_admin")
def retrieve_employee(employee_id):
    employee = get_superadmin_db().get_employee(employee_id)
    if not employee:
        return jsonify({"error": "Employee not found"}), 404
    return jsonify(employee), 200

@superadmin_bp.route("/superadmin/employees/<int:employee_id>", methods=["PUT"])
@token_required
@roles_required("super_admin")
def update_employee(employee_id):
    employee = get_superadmin_db().update_employee(employee_id, request.get_json(silent=True) or {})
    if not employee:
        return jsonify({"error": "Failed to update employee"}), 500
    return jsonify(employee), 200

@superadmin_bp.route("/superadmin/employees/<int:employee_id>/suspend", methods=["POST"])
@token_required
@roles_required("super_admin")
def suspend_employee(employee_id):
    employee = get_superadmin_db().set_employee_status(employee_id, "Suspended")
    if not employee:
        return jsonify({"error": "Failed to suspend employee"}), 500
    return jsonify(employee), 200

@superadmin_bp.route("/superadmin/employees/<int:employee_id>/activate", methods=["POST"])
@token_required
@roles_required("super_admin")
def activate_employee(employee_id):
    employee = get_superadmin_db().set_employee_status(employee_id, "Active")
    if not employee:
        return jsonify({"error": "Failed to activate employee"}), 500
    return jsonify(employee), 200

@superadmin_bp.route("/superadmin/employees/<int:employee_id>", methods=["DELETE"])
@token_required
@roles_required("super_admin")
def delete_employee(employee_id):
    ok = get_superadmin_db().delete_employee(employee_id)
    if not ok:
        return jsonify({"error": "Failed to delete employee"}), 500
    return jsonify({"message": "Employee deleted successfully"}), 200

@superadmin_bp.route("/superadmin/employees/<int:employee_id>/resend-invite", methods=["POST"])
@token_required
@roles_required("super_admin")
def resend_employee_invite(employee_id):
    token = secrets.token_urlsafe(64)
    expiry = datetime.now() + timedelta(minutes=30)
    employee = get_superadmin_db().reset_employee_invite(employee_id, token, expiry)
    if not employee:
        return jsonify({"error": "Failed to reset invite"}), 500
    threading.Thread(
        target=sending_mail_invite,
        args=(employee.get("email"), employee.get("name"), token),
        daemon=True,
    ).start()
    return jsonify({"message": "Invite regenerated", "mail_sent": "pending"}), 200

@superadmin_bp.route("/superadmin/students", methods=["GET"])
@token_required
@roles_required("super_admin")
def retrieve_cross_school_students():
    data = get_superadmin_db().get_students(
        request.args.get("search", ""),
        request.args.get("school_id", ""),
        request.args.get("status", ""),
        request.args.get("plan", ""),
    )
    if data is None:
        return jsonify({"error": "Failed to fetch students"}), 500
    return jsonify(data), 200

@superadmin_bp.route("/superadmin/students/<int:student_id>", methods=["GET"])
@token_required
@roles_required("super_admin")
def retrieve_cross_school_student(student_id):
    student = get_superadmin_db().get_student(student_id)
    if not student:
        return jsonify({"error": "Student not found"}), 404
    return jsonify(student), 200

@superadmin_bp.route("/superadmin/onboarding", methods=["GET"])
@token_required
@roles_required("super_admin")
def retrieve_onboarding():
    data = get_superadmin_db().get_onboarding()
    if data is None:
        return jsonify({"error": "Failed to fetch onboarding pipeline"}), 500
    return jsonify(data), 200

@superadmin_bp.route("/superadmin/onboarding/<int:school_id>", methods=["PUT"])
@token_required
@roles_required("super_admin")
def move_onboarding(school_id):
    stage = (request.get_json(silent=True) or {}).get("stage")
    status = "Active" if stage == "Active" else "Inactive"
    updated = get_superadmin_db().set_school_status(school_id, status)
    if not updated:
        return jsonify({"error": "Failed to update onboarding stage"}), 500
    return jsonify(updated), 200

@superadmin_bp.route("/superadmin/revenue", methods=["GET"])
@token_required
@roles_required("super_admin")
def retrieve_revenue():
    data = get_superadmin_db().get_revenue()
    if data is None:
        return jsonify({"error": "Failed to fetch revenue"}), 500
    return jsonify(data), 200

@superadmin_bp.route("/superadmin/tickets", methods=["GET"])
@token_required
@roles_required("super_admin")
def retrieve_tickets():
    data = get_superadmin_db().get_tickets(
        request.args.get("status", ""),
        request.args.get("priority", ""),
        request.args.get("school_id", ""),
    )
    if data is None:
        return jsonify({"error": "Failed to fetch tickets"}), 500
    return jsonify(data), 200

@superadmin_bp.route("/superadmin/tickets/<int:ticket_id>", methods=["PUT"])
@token_required
@roles_required("super_admin")
def update_ticket(ticket_id):
    status = (request.get_json(silent=True) or {}).get("status", "pending")
    updated = get_superadmin_db().update_ticket_status(ticket_id, status)
    if not updated:
        return jsonify({"error": "Failed to update ticket"}), 500
    return jsonify(updated), 200

@superadmin_bp.route("/superadmin/impersonation-log", methods=["GET"])
@token_required
@roles_required("super_admin")
def retrieve_impersonation_log():
    limit = request.args.get("limit", 50)
    return jsonify(get_superadmin_db().get_impersonation_log(limit)), 200

@superadmin_bp.route("/superadmin/activity-log", methods=["GET"])
@token_required
@roles_required("super_admin")
def retrieve_activity_log():
    limit = request.args.get("limit", 20)
    return jsonify(get_superadmin_db().get_activity_log(limit)), 200

@superadmin_bp.route("/superadmin/notifications", methods=["GET", "POST"])
@token_required
@roles_required("super_admin")
def superadmin_notifications():
    obj_sup = get_superadmin_db()
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("title"):
            return jsonify({"error": "Title is required"}), 400
        created = obj_sup.create_notification(data)
        if not created:
            return jsonify({"error": "Failed to send notification"}), 500
        return jsonify(created), 201
    return jsonify(obj_sup.get_notifications()), 200

@superadmin_bp.route("/superadmin/feature-flags", methods=["GET"])
@token_required
@roles_required("super_admin")
def retrieve_feature_flags():
    return jsonify(get_superadmin_db().get_feature_flags()), 200

@superadmin_bp.route("/superadmin/feature-flags/<key>", methods=["PUT"])
@token_required
@roles_required("super_admin")
def update_feature_flag(key):
    data = request.get_json(silent=True) or {}
    updated = get_superadmin_db().update_feature_flag(key, bool(data.get("enabled")))
    if not updated:
        return jsonify({"error": "Failed to update feature flag"}), 500
    return jsonify(updated), 200

@superadmin_bp.route("/superadmin/api-usage", methods=["GET"])
@token_required
@roles_required("super_admin")
def retrieve_api_usage():
    data = get_superadmin_db().get_api_usage()
    if data is None:
        return jsonify({"error": "Failed to fetch API usage"}), 500
    return jsonify(data), 200

def sending_mail_invite(to_email, user_name, token):
    type = "com-emp"  # Assuming this is the type for college admin. Adjust as necessary.
    link = f"http://127.0.0.1:5000/set-password?type={type}&token={token}"
    subject = f"{user_name}, your EduReg invitation is here"
    body = f"""
    <html>
        <body style="margin:0; padding:0; background:#f4f4f7; font-family: Arial, Helvetica, sans-serif;">
            <div style="max-width:480px; margin:0 auto; padding:30px 20px; background:#ffffff;">
                <h2 style="color:#111827;">Hello {user_name},</h2>

                <p style="color:#374151; font-size:15px; line-height:1.5;">
                    You've been invited to join <strong>EduReg</strong>.
                </p>

                <p style="color:#374151; font-size:15px; line-height:1.5;">
                    Click the button below to complete your registration and get started.
                </p>

                <p style="text-align:center; margin:30px 0;">
                    <a href="{link}"
                       style="background:#2563eb;
                              color:#ffffff;
                              padding:12px 25px;
                              text-decoration:none;
                              border-radius:5px;
                              font-weight:bold;
                              display:inline-block;">
                        Complete Registration
                    </a>
                </p>

                <p style="color:#6b7280; font-size:13px; line-height:1.5;">
                    Or copy and paste this link into your browser:<br>
                    <a href="{link}" style="color:#2563eb; word-break:break-all;">{link}</a>
                </p>

                <p style="color:#374151; font-size:14px;">
                    For security, this link will expire in <strong>30 minutes</strong>.
                </p>

                <p style="color:#6b7280; font-size:13px;">
                    Didn't request this? No action is needed — you can safely ignore this email.
                </p>

                <p style="color:#374151; font-size:14px;">
                    Welcome aboard,<br><strong>The EduReg Team</strong>
                </p>
            </div>
        </body>
    </html>
    """

    mail_sent = send_mail(to_email, subject, body)
    return bool(mail_sent)