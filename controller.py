from flask import Flask, Response, jsonify, render_template, request
from shared.model import controller
from superadmin_Dash_APIs.controller import superadmin_bp
import bcrypt
import jwt
import csv
import io
import datetime
import os
app = Flask(__name__)
obj=controller()
SECRET_KEY = os.getenv("JWT_SECRET")
app.register_blueprint(superadmin_bp)

@app.route('/', methods=['GET'])
def index():
    return render_template("index.html")

@app.route('/login.html', methods=['GET'])
def dashboard():
    return render_template("login.html")

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

@app.route('/admin.html', methods=['GET'])
def super_admin():
    return render_template("super_admin.html")

if __name__ == '__main__':
    app.run(debug=True)
    # add this temporarily, right before app.run()
    print(app.url_map)
