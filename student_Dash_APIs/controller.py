from flask import Blueprint, Response, jsonify, render_template, request
from shared.model import controller
import bcrypt
import jwt
import csv
import io
import datetime
import os

student_bp = Blueprint('student', __name__)  # instead of app
obj = controller()
SECRET_KEY = os.getenv("JWT_SECRET")

@student_bp.route('/student', methods=['GET'])
def students():
    return render_template("student_portal.html")