from flask import Flask, Response, jsonify, render_template, request
from shared.model import controller
from superadmin_Dash_APIs.controller import superadmin_bp
from collage_Dash_APIs.controller import collage_bp
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
def set_password():
     return render_template('set-password.html')

@app.route("/collage_portal.html",methods=["GET"])
def collage_portal():
    return render_template("collage_portal.html")

if __name__ == '__main__':
    app.run(debug=True)
    # add this temporarily, right before app.run()
    print(app.url_map)
