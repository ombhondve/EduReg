from flask import Blueprint, Response, jsonify, render_template, request
from shared.model import controller
import bcrypt
import jwt
import csv
import io
import datetime
import os

superadmin_bp = Blueprint('superadmin', __name__)  # instead of app
obj = controller()
SECRET_KEY = os.getenv("JWT_SECRET")

@superadmin_bp.route("/superadmin/schools", methods=["POST"])
def add_school():
    data = request.get_json()
    print(data)
    return jsonify(data)