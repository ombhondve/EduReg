from flask import Blueprint, jsonify, request
from collage_Dash_APIs.model import collage_models
import os

collage_bp = Blueprint('collages', __name__)
col_obj = collage_models()

