from flask import Flask, render_template
from superadmin_Dash_APIs.controller import superadmin_bp
from collage_Dash_APIs.controller import collage_bp
from student_Dash_APIs.controller import student_bp
from Auth.controller import Auth_bp
import os
from db_helpers import close_db

app = Flask(__name__)
SECRET_KEY = os.getenv("JWT_SECRET")
app.register_blueprint(Auth_bp)
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

@app.route('/admin_login', methods=['GET'])
def admin_login():
    return render_template("Ad_login.html")

@app.route('/admin.html', methods=['GET'])
def super_admin():
    return render_template("super_admin.html")

@app.route("/set-password", methods=["GET"])
def set_password_temp():
    return render_template('set-password.html')

@app.route("/collage_portal.html", methods=["GET"])
def collage_portal():
    return render_template("collage_portal.html")

if __name__ == '__main__':
    app.run(debug=True)
