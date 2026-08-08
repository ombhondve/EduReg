# services/tenant_provisioning.py
#
# Per-college ("tenant") database provisioning.
#
# Every college/organization gets its own isolated MySQL database named
#   edureg_org_{organization_id}
# containing all of the tables that college's dashboard needs (students,
# courses, documents, attendance, grades, fee_records, timetable, calendar,
# messages, staff, notifications, activity log, app settings).
#
# This is what actually powers "database-per-tenant" isolation: instead of
# every college's rows living side-by-side in one shared database (kept
# apart only by an organization_id column), each college gets a fully
# separate database. The central database still holds the small set of
# cross-tenant/superadmin tables (organizations, organization_admins,
# organization_plans, support_tickets, impersonation_log, ...).
#
# The table list below is intentionally the single source of truth for the
# tenant schema — shared/model.py's legacy ensure_core_schema() imports it
# too, so the two never drift apart.

import os
import re

import pymysql
from pymysql import cursors

# Only letters, digits, and underscores are allowed in an identifier we
# build ourselves for a raw CREATE DATABASE / USE statement (those can't be
# parameterized like normal query values, so we validate manually instead).
_SAFE_IDENT = re.compile(r'^[A-Za-z0-9_]+$')

TENANT_DB_PREFIX = "edureg_org_"


class UnsafeIdentifierError(ValueError):
    """Raised when an organization id can't be turned into a safe SQL identifier."""


def tenant_db_name(organization_id):
    """Build (and validate) the per-college database name for an org id.

    Example: tenant_db_name(101) -> 'edureg_org_101'
    """
    db_name = f"{TENANT_DB_PREFIX}{organization_id}"
    if not _SAFE_IDENT.match(db_name):
        raise UnsafeIdentifierError(
            f"organization_id {organization_id!r} produced an unsafe database "
            f"name ({db_name!r}); only letters, digits and underscores are allowed."
        )
    return db_name


# ---------------------------------------------------------------------
# Tenant schema: every table a single college's dashboard needs.
# ---------------------------------------------------------------------

TENANT_TABLE_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS courses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        course_code VARCHAR(50) NOT NULL UNIQUE,
        duration VARCHAR(50) DEFAULT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'Active'
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        firstName VARCHAR(100) NOT NULL,
        lastName VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        phone VARCHAR(30) DEFAULT NULL,
        dob DATE DEFAULT NULL,
        gender VARCHAR(30) DEFAULT NULL,
        address TEXT DEFAULT NULL,
        year VARCHAR(50) DEFAULT NULL,
        gpa DECIMAL(4,2) DEFAULT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'Active',
        notes TEXT DEFAULT NULL,
        course_id INT DEFAULT NULL,
        hashed_password VARCHAR(255) DEFAULT NULL,
        reset_token VARCHAR(255) DEFAULT NULL,
        token_expiry DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_students_courses
            FOREIGN KEY (course_id) REFERENCES courses(id)
            ON UPDATE CASCADE
            ON DELETE SET NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        doc_type VARCHAR(100) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) DEFAULT NULL,
        mime_type VARCHAR(120) DEFAULT NULL,
        size_bytes INT DEFAULT 0,
        status VARCHAR(40) NOT NULL DEFAULT 'Pending Review',
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_by VARCHAR(120) DEFAULT NULL,
        reviewed_at DATETIME DEFAULT NULL,
        review_note TEXT DEFAULT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        message TEXT,
        type VARCHAR(40) DEFAULT 'general',
        audience VARCHAR(40) DEFAULT 'all',
        audience_value VARCHAR(150) DEFAULT NULL,
        student_id INT DEFAULT NULL,
        recipient_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        course_id INT DEFAULT NULL,
        date DATE NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'Present',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS grades (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        course_id INT DEFAULT NULL,
        term VARCHAR(60) DEFAULT NULL,
        grade VARCHAR(10) DEFAULT NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'Published',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS fee_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT DEFAULT NULL,
        student_name VARCHAR(200) DEFAULT NULL,
        fee_type VARCHAR(80) DEFAULT NULL,
        amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        status VARCHAR(40) NOT NULL DEFAULT 'Pending',
        due_date DATE DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS staff (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        phone VARCHAR(30) DEFAULT NULL,
        designation VARCHAR(120) DEFAULT NULL,
        department VARCHAR(120) DEFAULT NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS timetable (
        id INT AUTO_INCREMENT PRIMARY KEY,
        course_id INT DEFAULT NULL,
        day VARCHAR(20) NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        subject VARCHAR(150) NOT NULL,
        room VARCHAR(80) DEFAULT NULL,
        staff_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS calendar_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        event_date DATE NOT NULL,
        event_type VARCHAR(50) NOT NULL DEFAULT 'General',
        description TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT DEFAULT NULL,
        student_name VARCHAR(200) NOT NULL,
        sender VARCHAR(30) NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS activity_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        actor VARCHAR(150) NOT NULL,
        action VARCHAR(150) NOT NULL,
        target VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS app_settings (
        setting_key VARCHAR(80) PRIMARY KEY,
        setting_value TEXT
    )
    """,
]

# Seeded once into every brand-new tenant database so a college's course
# dropdowns aren't empty on day one. Same defaults the old shared schema used.
DEFAULT_COURSES = [
    ("Computer Science Engineering", "CSE", "4 years", "Active"),
    ("Mechanical Engineering", "ME", "4 years", "Active"),
    ("Civil Engineering", "CE", "4 years", "Active"),
    ("Electrical Engineering", "EE", "4 years", "Active"),
    ("Business Administration", "BBA", "3 years", "Active"),
]


def _admin_connection():
    """A connection with no database selected — the only way to run
    CREATE DATABASE, since a session can't create the DB it's already
    'USE'-d into in one consistent step."""
    return pymysql.connect(
        host=os.getenv("host"),
        user=os.getenv("user"),
        password=os.getenv("password"),
        cursorclass=cursors.DictCursor,
        autocommit=False,
    )


def create_tenant_database(organization_id):
    """Create the dedicated database for one college and make sure every
    required table exists inside it.

    Idempotent: safe to call again for a college that already has a
    database (CREATE DATABASE/TABLE IF NOT EXISTS), so this also doubles
    as a "repair/resync a tenant's schema" helper.

    Returns the database name on success. Raises on failure — callers are
    expected to roll back whatever organization row they just inserted if
    this raises, so we never leave a college half-provisioned.
    """
    db_name = tenant_db_name(organization_id)

    conn = _admin_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
                f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        conn.commit()

        # Switch this same connection into the new database, then build
        # every table inside it.
        conn.select_db(db_name)
        with conn.cursor() as cur:
            for statement in TENANT_TABLE_STATEMENTS:
                cur.execute(statement)

            cur.execute("SELECT COUNT(*) AS total FROM courses")
            if (cur.fetchone() or {}).get("total", 0) == 0:
                cur.executemany(
                    """
                    INSERT INTO courses (name, course_code, duration, status)
                    VALUES (%s, %s, %s, %s)
                    """,
                    DEFAULT_COURSES,
                )
        conn.commit()
        return db_name
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def drop_tenant_database(organization_id):
    """Permanently delete a college's entire database. Not wired into any
    route automatically — deleting a college's data is destructive, so it's
    left here as an explicit, deliberate action a caller has to opt into."""
    db_name = tenant_db_name(organization_id)
    conn = _admin_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"DROP DATABASE IF EXISTS `{db_name}`")
        conn.commit()
        return db_name
    finally:
        conn.close()