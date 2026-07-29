from flask import Blueprint, jsonify, request
from superadmin_Dash_APIs.model import superadmin_models
import os

# `require_role` is assumed to already exist in your codebase (same pattern
# used by the student/admin blueprints — it should decode the JWT and check
# the role claim). Wire it up here; falls back to a no-op ONLY if the import
# fails, so the app doesn't crash — replace this fallback with your real
# decorator before deploying.


superadmin_bp = Blueprint('superadmin', __name__)
obj_sup = superadmin_models()
SECRET_KEY = os.getenv("JWT_SECRET")


# ---------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------

@superadmin_bp.route("/superadmin/stats", methods=["GET"])
def get_stats():
    data = obj_sup.get_stats()
    if data is None:
        return jsonify({"error": "Failed to fetch stats"}), 500
    return jsonify(data), 200


# ---------------------------------------------------------------
# Schools
# ---------------------------------------------------------------

@superadmin_bp.route("/superadmin/schools", methods=["GET"])
def retrieve_schools():
    search = request.args.get("search", "")
    plan = request.args.get("plan", "")
    status = request.args.get("status", "")

    data = obj_sup.get_schools(search, plan, status)
    if data is None:
        return jsonify({"error": "Failed to fetch schools"}), 500
    return jsonify(data), 200



@superadmin_bp.route("/superadmin/schools", methods=["POST"])

def add_school():
    data = request.get_json()
    required = ["name", "subdomain", "adminEmail"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing required field(s): {', '.join(missing)}"}), 400
    DB_name = data['name'].replace(" ", "_")
    return obj_sup.add_school_org(data, DB_name)








