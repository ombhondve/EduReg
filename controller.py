from flask import Flask, Response, jsonify, render_template, request
from shared.model import controller
from superadmin_Dash_APIs.controller import superadmin_bp
from collage_Dash_APIs.controller import collage_bp
from services.hashed_passwords import hash_pass
import bcrypt, jwt, csv, io, os
from datetime import datetime

app = Flask(__name__)
obj=controller()
SECRET_KEY = os.getenv("JWT_SECRET")
app.register_blueprint(superadmin_bp)
app.register_blueprint(collage_bp)

@app.route('/', methods=['GET'])
def index():
    return render_template("index.html")

@app.route('/login.html', methods=['GET'])
def dashboard():
    return render_template("login.html")

@app.route('/admin_login.html', methods=['GET'])
def admin_login():
    return render_template("Ad_login.html")

@app.route('/admin.html', methods=['GET'])
def super_admin():
    return render_template("super_admin.html")

@app.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email=data.get('email')
    print(email)
    user = obj.fetch_user_by_email(email)
    print(user)
    return jsonify({
    "message": "Login successful",
    "user": {
        "email": user["admin_email"],
        "role": "staff"
    }
})

@app.route("/set-password", methods=["GET"])
def set_password_temp():
     return render_template('set-password.html')

@app.route("/auth/set-password", methods=["POST"])
def set_passwords():
    data = request.get_json(silent=True) or {}
    token = data.get("token")
    password = data.get("password")

    if not token or not password:
        return jsonify({"success": False, "message": "Token and password are required"}), 400

    user_data = obj.fetch_user_by_token(token)
    if not user_data:
        return jsonify({"success": False, "message": "Invalid or expired reset link"}), 400

    token_expiry = user_data.get("token_expiry")
    if not token_expiry or token_expiry < datetime.now():
        return jsonify({"success": False, "message": "This reset link has expired"}), 400

    hash_password = hash_pass(password)
    result = obj.set_password(hash_password, user_data.get("admin_id"))

    if result:
        return jsonify({"success": True, "message": "Password set successfully"}), 200
    else:
        return jsonify({"success": False, "message": "Failed to set password. Please try again."}), 500


@app.route("/collage_portal.html",methods=["GET"])
def collage_portal():
    return render_template("collage_portal.html")

if __name__ == '__main__':
    app.run(debug=True)
    # add this temporarily, right before app.run()

