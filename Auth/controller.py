from functools import wraps
import datetime
import json
import os

import jwt
from flask import Blueprint, jsonify, request

from db_helpers import get_main_db, get_search_db
from services.hashed_passwords import hash_pass, check_hash_pass

Auth_bp = Blueprint('Authentication', __name__)

SECRET_KEY = os.getenv("JWT_SECRET")
ACCESS_TOKEN_TTL = datetime.timedelta(hours=8)
REFRESH_TOKEN_TTL = datetime.timedelta(days=7)


# ----------------------------------------------------------------------
# JWT helpers — shared by every route below, and importable by other
# blueprints that want to verify who's calling (see token_required).
# ----------------------------------------------------------------------
def _issue_tokens(claims):
    now = datetime.datetime.utcnow()
    access_payload = {**claims, "type": "access", "iat": now, "exp": now + ACCESS_TOKEN_TTL}
    refresh_payload = {
        **claims,                     # keep everything, not just id/role
        "type": "refresh", "iat": now, "exp": now + REFRESH_TOKEN_TTL,
    }
    access_token = jwt.encode(access_payload, SECRET_KEY, algorithm="HS256")
    refresh_token = jwt.encode(refresh_payload, SECRET_KEY, algorithm="HS256")
    return access_token, refresh_token


def _decode(token):
    """Returns (payload, error_message). error_message is None on success."""
    if not token:
        return None, "Authentication required"
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"]), None
    except jwt.ExpiredSignatureError:
        return None, "Session expired"
    except jwt.InvalidTokenError:
        return None, "Invalid token"


def token_required(f):
    """Verifies the Authorization: Bearer <accessToken> header and attaches
    the decoded claims to request.auth_user. Other blueprints (student,
    collage, superadmin) should wrap their routes with this instead of
    trusting a client-supplied id, e.g. request.auth_user['id']."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        token = header.split(" ", 1)[1] if header.startswith("Bearer ") else None
        payload, error = _decode(token)
        if error:
            return jsonify({"error": error}), 401
        if payload.get("type") != "access":
            return jsonify({"error": "Invalid token type"}), 401
        request.auth_user = payload
        return f(*args, **kwargs)
    return wrapper


def roles_required(*allowed_roles):
    """Gate a route to specific roles. Verifies the token (same as
    token_required) and additionally checks that the caller's role is
    one of allowed_roles. Checks both the single `role` claim
    (student/college_admin logins) and the `roles` list claim (employee
    logins, who can hold more than one role — see po_admin_login above),
    so it works for either token shape.

    Usage: @roles_required("super_admin") or @roles_required("super_admin", "billing")
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            header = request.headers.get("Authorization", "")
            token = header.split(" ", 1)[1] if header.startswith("Bearer ") else None
            payload, error = _decode(token)
            if error:
                return jsonify({"error": error}), 401
            if payload.get("type") != "access":
                return jsonify({"error": "Invalid token type"}), 401

            user_roles = payload.get("roles") or ([payload["role"]] if payload.get("role") else [])
            if not any(r in allowed_roles for r in user_roles):
                return jsonify({"error": "You do not have permission to access this resource"}), 403

            request.auth_user = payload
            return f(*args, **kwargs)
        return wrapper
    return decorator


def _as_list(value):
    """Employees.roles / .pages are stored as JSON text; normalize to a list."""
    if isinstance(value, list):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else [parsed]
        except (TypeError, ValueError):
            return [value]
    return []


# ----------------------------------------------------------------------
# Student / college login
# ----------------------------------------------------------------------

@Auth_bp.route('/auth/login', methods=['POST'])
def login():
    
    search_obj = get_search_db()
    data = request.get_json(silent=True) or {}
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'college')

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password are required"}), 400

    if role == "student":
        directory = search_obj.fetch_user_by_any("student_directory", "email", email)
        if not directory:
            return jsonify({"success": False, "message": "Invalid email or password"}), 401
        org_id = directory["organization_id"]

        from student_Dash_APIs.model import student_models
        tenant_db = student_models(organization_id=org_id)
        user = tenant_db._query_one("SELECT * FROM students WHERE email=%s", (email,))
        tenant_db.close()
        if not user:
            return jsonify({"success": False, "message": "Invalid email or password"}), 401
        user["organization_id"] = org_id   # students table has no org_id column itself
        login_role = "student"
    else:
        table_name, col_name, login_role = "organization_admins", "admin_email", "college_admin"
        user = search_obj.fetch_user_by_any(table_name, col_name, email)
        if not user:
            return jsonify({"success": False, "message": "Invalid email or password"}), 401

    user = search_obj.fetch_user_by_any(table_name, col_name, email)
    print(user)
    if not user:
        return jsonify({"success": False, "message": "Invalid email or password"}), 401

    db_hash = user.get("hashed_password")
    if not db_hash or not check_hash_pass(password, db_hash):
        return jsonify({"success": False, "message": "Invalid email or password"}), 401

    display_name = user.get("admin_name") or f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
    access_token, refresh_token = _issue_tokens({
        "id": user.get("id"),
        "email": email,
        "role": login_role,
        "name": display_name,
        "organization_id": user.get("organization_id")
    })
    return jsonify({
        "success": True,
        "id": user.get("id"),
        "name": display_name,
        "email": email,
        "role": login_role,
        "accessToken": access_token,
        "refreshToken": refresh_token,
    }), 200


# ----------------------------------------------------------------------
# Employee / platform-admin login
# ----------------------------------------------------------------------

@Auth_bp.route('/auth/admin_login', methods=["POST"])
def po_admin_login():
    search_obj = get_search_db()
    data = request.get_json(silent=True) or {}
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password are required"}), 400

    data_user = search_obj.fetch_user_by_any("employees", "email", email)
    if not data_user:
        return jsonify({"success": False, "message": "Invalid email or password"}), 401

    db_pass_hash = data_user.get('hashed_password')
    if not db_pass_hash:
        return jsonify({"success": False, "message": "Password is not set yet"}), 401

    if not check_hash_pass(password, db_pass_hash):
        return jsonify({"success": False, "message": "Invalid email or password"}), 401

    roles = _as_list(data_user.get("roles"))
    pages = _as_list(data_user.get("pages"))
    primary_role = roles[0] if roles else None

    access_token, refresh_token = _issue_tokens({
        "id": data_user.get("id"), "email": email, "role": primary_role,
        "roles": roles, "pages": pages, "name": data_user.get("name"),
    })
    return jsonify({
        "success": True,
        "id": data_user.get("id"),
        "name": data_user.get("name"),
        "email": email,
        "role": primary_role,
        "roles": roles,
        "pages": pages,
        "accessToken": access_token,
        "refreshToken": refresh_token,
    }), 200


# ----------------------------------------------------------------------
# Signup — self-serve account creation (referenced by auth.js's signup tab).
#
# NOTE / assumption: there's no self-serve "create a school" flow anywhere
# else in this codebase — organizations are only created by a super admin
# (superadmin_bp's add_school_org, invite-only). So this creates a
# lightweight record in a generic `users` table (name, email,
# hashed_password, role, created_at) rather than a full organization +
# organization_admin. It's enough to authenticate and land on
# collage_portal.html, but it is NOT wired to a real school/organization
# yet — if that's the intent, this needs to call the same school-creation
# path superadmin_bp uses instead.
# ----------------------------------------------------------------------

@Auth_bp.route('/auth/signup', methods=['POST'])
def signup():
    data = request.get_json(silent=True) or {}
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')

    if not name or not email or not password:
        return jsonify({"error": "Name, email and password are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    search_obj = get_search_db()
    if search_obj.fetch_user_by_any("users", "email", email):
        return jsonify({"error": "An account with this email already exists"}), 409

    hashed_password = hash_pass(password)
    try:
        search_obj.cur.execute(
            "INSERT INTO users (name, email, hashed_password, role, created_at) VALUES (%s, %s, %s, %s, NOW())",
            (name, email, hashed_password, "college_admin"),
        )
        search_obj.conn.commit()
        user_id = search_obj.cur.lastrowid
    except Exception as e:
        print(e)
        search_obj.conn.rollback()
        return jsonify({"error": "Failed to create account"}), 500

    access_token, refresh_token = _issue_tokens({
        "id": user_id, "email": email, "role": "college_admin", "name": name,
    })
    return jsonify({
        "id": user_id,
        "name": name,
        "email": email,
        "role": "college_admin",
        "accessToken": access_token,
        "refreshToken": refresh_token,
    }), 201


# ----------------------------------------------------------------------
# Refresh / logout
# ----------------------------------------------------------------------

@Auth_bp.route('/auth/refresh', methods=['POST'])
def refresh():
    data = request.get_json(silent=True) or {}
    payload, error = _decode(data.get('refreshToken'))
    if error:
        return jsonify({"error": error}), 401
    if payload.get("type") != "refresh":
        return jsonify({"error": "Invalid token type"}), 401

    # forward every claim from the refresh token except its own type/iat/exp
    claims = {k: v for k, v in payload.items() if k not in ("type", "iat", "exp")}
    access_token, _ = _issue_tokens(claims)
    return jsonify({"accessToken": access_token}), 200

@Auth_bp.route('/auth/logout', methods=['POST'])
def logout():
    # Tokens are stateless JWTs with no server-side session to clear;
    # the client dropping them (clearCurrentUser()) is what actually logs
    # the user out. This just gives the frontend a clean 200 to call.
    return jsonify({"message": "Logged out"}), 200


# ----------------------------------------------------------------------
# Set password (from an emailed invite / reset link)
# ----------------------------------------------------------------------

@Auth_bp.route("/auth/set-password", methods=["POST"])
def set_passwords():
    obj = get_main_db()
    data = request.get_json(silent=True) or {}
    token = data.get("token")
    password = data.get("password")
    user_type = data.get("type")

    role_by_type = {
        "col-admin": "organization_admins",
        "com-emp": "employees",
        "student": "students",
    }
    role = role_by_type.get(user_type)
    if role is None:
        print("Unknown user type:", user_type)

    if not token or not password:
        return jsonify({"success": False, "message": "Token and password are required"}), 400

    user_data = obj.fetch_user_by_token(role, token)
    if not user_data:
        return jsonify({"success": False, "message": "Invalid or expired reset link"}), 400

    token_expiry = user_data.get("token_expiry")
    # PyMySQL's DictCursor already returns DATETIME columns as native
    # datetime objects, not strings — only parse it if it actually came
    # back as a string (e.g. from a driver/config that stringifies dates).
    if isinstance(token_expiry, str):
        try:
            token_expiry = datetime.datetime.strptime(token_expiry, "%Y-%m-%d %H:%M:%S.%f")
        except ValueError:
            token_expiry = datetime.datetime.strptime(token_expiry, "%Y-%m-%d %H:%M:%S")
    if not token_expiry or token_expiry < datetime.datetime.now():
        return jsonify({"success": False, "message": "This reset link has expired"}), 400

    hashed_password = hash_pass(password)
    result = obj.set_password(role, hashed_password, user_data.get("id"))
    if not result:
        return jsonify({"success": False, "message": "Failed to set password. Please try again."}), 500

    if user_type == "com-emp":
        obj.changes_status(role, "Accepted", user_data.get("id"))
    return jsonify({"success": True, "message": "Password set successfully"}), 200