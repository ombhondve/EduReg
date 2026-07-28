from flask import Blueprint, Response, jsonify, render_template, request
from shared.model import controller
import bcrypt
import jwt
import csv
import io
import datetime
import os

Auth_bp = Blueprint('Authentication', __name__)  # instead of app
obj = controller()
SECRET_KEY = os.getenv("JWT_SECRET")

