from flask import Flask, jsonify, render_template, request
from superadmin_Dash_APIs.controller import superadmin_bp
from collage_Dash_APIs.controller import collage_bp
from student_Dash_APIs.controller import student_bp
from services.hashed_passwords import hash_pass, check_hash_pass
import os, json
from datetime import datetime
from flask import g
from db_helpers import get_main_db, get_search_db, close_db
#hii
app = Flask(__name__)
SECRET_KEY = os.getenv("JWT_SECRET")
app.register_blueprint(superadmin_bp)
app.register_blueprint(collage_bp)
app.register_blueprint(student_bp)
app.teardown_request(close_db)
        
@app.route('/', methods=['GET'])
def index():
    return render_template("index.html")

@app.route('/login.html', methods=['GET'])
def dashboard():
    return render_template("login.html")

# Student / college page (login.js) → POST /auth/login
@app.route('/auth/login', methods=['POST'])
def login():
    search_obj = get_search_db()
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'college')

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password are required"}), 400

    if role == "student":
        table_name, col_name, login_role = "students", "email", "student"
    else:
        table_name, col_name, login_role = "organization_admins", "admin_email", "college_admin"

    user = search_obj.fetch_user_by_any(table_name, col_name, email)
    if not user:
        return jsonify({"success": False, "message": "Invalid email or password"}), 401

    db_hash = user.get("hashed_password")
    if not db_hash or not check_hash_pass(password, db_hash):
        return jsonify({"success": False, "message": "Invalid email or password"}), 401

    display_name = user.get("admin_name") or f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
    return jsonify({
        "success": True,
        "id": user.get("id"),
        "name": display_name,
        "email": email,
        "role": login_role,
        "accessToken": "local-session",
        "refreshToken": "local-refresh",
    }), 200

@app.route('/admin_login', methods=['GET'])
def admin_login():
    return render_template("Ad_login.html")


@app.route('/auth/admin_login', methods=["POST"])
def po_admin_login():
    search_obj = get_search_db()
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    table_name="employees"
    col_name="email"
    data_user=search_obj.fetch_user_by_any(table_name,col_name,email)
    if not data_user:
        return jsonify({"success": False, "message": "Invalid email or password"}), 401
    db_pass_hash=data_user.get('hashed_password')
    if not db_pass_hash:
        return jsonify({"success": False, "message": "Password is not set yet"}), 401
    result=check_hash_pass(password,db_pass_hash)
    roles = json.loads(data_user["roles"])
    print(roles[0])
    if result is True:
        return jsonify({
            "success": True,
            "message": "Debug: data received",
            "role": roles[0],      # Role from the database
            "received": data
        }), 200
    else:
        return jsonify({
            "success": False,
            "message": "Debug: data Not Reveived",
            "received": data
        }), 500

    # Debug-only response so you can see it working end-to-end.
    # Replace this with real login logic once you're done inspecting.



@app.route('/admin.html', methods=['GET'])
def super_admin():
    return render_template("super_admin.html")

@app.route("/set-password", methods=["GET"])
def set_password_temp():
     return render_template('set-password.html')

@app.route("/auth/set-password", methods=["POST"])
def set_passwords():
    obj = get_main_db()
    data = request.get_json(silent=True) or {}
    token = data.get("token")
    password = data.get("password")
    user_type = data.get("type")

    match user_type:
        case "col-admin":
            role = "organization_admins"

        case "com-emp":
            role = "employees"

        case "student":
            role = "student"

        case _:
            role = None
            print("Unknown user type")
    if not token or not password:
        return jsonify({"success": False, "message": "Token and password are required"}), 400

    user_data = obj.fetch_user_by_token(role,token)
    if not user_data:
        return jsonify({"success": False, "message": "Invalid or expired reset link"}), 400

    token_expiry = user_data.get("token_expiry")
    token_expiry = datetime.strptime(
    token_expiry,
    "%Y-%m-%d %H:%M:%S.%f"
    )
    if not token_expiry or token_expiry < datetime.now():
        return jsonify({"success": False, "message": "This reset link has expired"}), 400

    hash_password = hash_pass(password)
    result = obj.set_password(role, hash_password, user_data.get("id"))
    if result:
        if user_type == "com-emp":
            status = obj.changes_status(role, "Accepted", data.get("id"))
        return jsonify({"success": True, "message": "Password set successfully"}), 200
    else:
        return jsonify({"success": False, "message": "Failed to set password. Please try again."}), 500

def emp_update(status, id):
    return True
@app.route("/collage_portal.html",methods=["GET"])
def collage_portal():
    return render_template("collage_portal.html")

if __name__ == '__main__':
    app.run(debug=True)
    # add this temporarily, right before app.run()

