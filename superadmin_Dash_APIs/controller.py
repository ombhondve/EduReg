from flask import Blueprint, Response, jsonify, render_template, request
from superadmin_Dash_APIs.model import superadmin_models
import bcrypt
import jwt
import csv
import io
import datetime
import os

superadmin_bp = Blueprint('superadmin', __name__)  # instead of app
obj_sup = superadmin_models()
SECRET_KEY = os.getenv("JWT_SECRET")

@superadmin_bp.route("/superadmin/schools", methods=["POST"])
def add_school():
    data = request.get_json()
    return obj_sup.add_school_org(data)