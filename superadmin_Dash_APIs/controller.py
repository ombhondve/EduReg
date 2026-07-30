from flask import Flask, Response, jsonify, render_template, request, Blueprint
from superadmin_Dash_APIs.model import superadmin_models
import os
import secrets
from datetime import datetime, timedelta
from services.email_service import send_mail
# `require_role` is assumed to already exist in your codebase (same pattern
# used by the student/admin blueprints — it should decode the JWT and check
# the role claim). Wire it up here; falls back to a no-op ONLY if the import
# fails, so the app doesn't crash — replace this fallback with your real
# decorator before deploying.


superadmin_bp = Blueprint('superadmin', __name__)
obj_sup = superadmin_models()
SECRET_KEY = os.getenv("JWT_SECRET")


# ---------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------

@superadmin_bp.route("/superadmin/stats", methods=["GET"])
def get_stats():
    data = obj_sup.get_stats()
    if data is None:
        return jsonify({"error": "Failed to fetch stats"}), 500
    return jsonify(data), 200


# ---------------------------------------------------------------
# Schools
# ---------------------------------------------------------------

@superadmin_bp.route("/superadmin/schools", methods=["GET"])
def retrieve_schools():
    search = request.args.get("search", "")
    plan = request.args.get("plan", "")
    status = request.args.get("status", "")

    data = obj_sup.get_schools(search, plan, status)
    if data is None:
        return jsonify({"error": "Failed to fetch schools"}), 500
    return jsonify(data), 200



@superadmin_bp.route("/superadmin/schools", methods=["POST"])

def add_school():
    data = request.get_json()
    required = ["name", "subdomain", "adminEmail"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing required field(s): {', '.join(missing)}"}), 400

    DB_name = data['name'].replace(" ", "_")
    data['reset_token'] = secrets.token_urlsafe(64)
    data['token_expiry'] = (datetime.now() + timedelta(minutes=30))

    status = obj_sup.add_school_org(data, DB_name)
    if status is True:
        mail_sent = sending_mail(data.get('adminEmail'), data.get('adminName'), data.get('reset_token'))
        return jsonify({"message": "School added successfully", "mail_sent": mail_sent}), 201
    else:
        return jsonify({"error": "Failed to add school organization"}), 500
    
# in controller.py
def sending_mail(to_email, user_name, token):
    link = f"http://127.0.0.1:5000/set-password?token={token}"

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







