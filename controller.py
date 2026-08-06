from flask import Flask, render_template

from extensions import limiter
from superadmin_Dash_APIs.controller import superadmin_bp
from collage_Dash_APIs.controller import collage_bp
from student_Dash_APIs.controller import student_bp
from Auth.controller import Auth_bp
import os
from db_helpers import close_db

app = Flask(__name__)
SECRET_KEY = os.getenv("JWT_SECRET")

# --- Hard fail fast if the app is misconfigured -----------------------
if not SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET is not set. Configure it via environment variables "
        "before starting the app (see .env.example)."
    )

# --- Upload size cap (fixes: unrestricted file upload / DoS via huge files)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB per request

# --- Rate limiting (fixes: brute force on auth endpoints) --------------
# Swap storage_uri for a real Redis URI in production — the in-memory
# default only limits per-process and resets on restart.
app.config["RATELIMIT_STORAGE_URI"] = os.getenv("RATE_LIMIT_STORAGE_URI", "memory://")
limiter.init_app(app)

app.register_blueprint(Auth_bp)
app.register_blueprint(superadmin_bp)
app.register_blueprint(collage_bp)
app.register_blueprint(student_bp)
app.teardown_request(close_db)


# --- Security headers on every response ---------------------------------
@app.after_request
def set_security_headers(resp):
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    resp.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    resp.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'"
    )
    # Only send HSTS when actually served over HTTPS (e.g. behind a TLS-terminating proxy)
    if os.getenv("FORCE_HTTPS", "false").lower() == "true":
        resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return resp


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
    # NEVER set debug=True outside local development. FLASK_DEBUG must be
    # explicitly opted into via env var, and must never be true in
    # production (Werkzeug's debugger allows remote code execution, and
    # debug mode leaks full stack traces to the client).
    debug_mode = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(debug=debug_mode)
