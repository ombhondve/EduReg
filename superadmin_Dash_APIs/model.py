import re, json
from datetime import datetime
from flask import jsonify
from shared.model import controller
from services.tenant_provisioning import create_tenant_database
from services.tenant_provisioning import drop_tenant_database
# Static price-per-plan used only to compute MRR for the dashboard.
# Adjust to your real pricing — this is not stored anywhere in the DB.
PLAN_PRICES = {
    'trial': 0,
    'basic': 4999,
    'pro': 12999,
    'enterprise': 34999,
}

# Column allowed for identifiers we build ourselves (used for CREATE DATABASE,
# which can't be parameterized like normal query values).
_SAFE_IDENT = re.compile(r'^[A-Za-z0-9_]+$')


# ---------------------------------------------------------------------
# Master-database schema: the cross-tenant / superadmin-only tables.
#
# BUG FIX: none of these tables were ever created anywhere. `controller`
# (shared/model.py) only bootstraps TENANT_TABLE_STATEMENTS — the per-college
# tables (courses, students, documents, ...) — against the master database,
# which is meant for the legacy single-tenant "college portal" and does NOT
# include organizations/organization_admins/organization_plans/employees/
# support_tickets/impersonation_log/feature_flags. Every superadmin query
# that touched those tables was failing with a DB error (table doesn't
# exist), which model.py already converts into a 500 via its except blocks.
#
# Also note: get_students()/get_student() below intentionally query
# `student_directory`, NOT `students`. The master DB's `students` table is
# the *tenant-shaped* one created by ensure_core_schema (firstName/lastName/
# course_id/...), completely different from the cross-tenant directory shape
# this blueprint needs (organization_id/rollNo/name/program/lastActive). Two
# tables with different schemas can't share one name — `student_directory`
# is the "cross-tenant, read-only directory synced from schools" table the
# original comment above get_students() already described.
# ---------------------------------------------------------------------

MASTER_TABLE_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS organizations (
        organization_id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        subdomain VARCHAR(100) NOT NULL UNIQUE,
        type VARCHAR(60) DEFAULT NULL,
        website VARCHAR(255) DEFAULT NULL,
        address VARCHAR(255) DEFAULT NULL,
        city VARCHAR(120) DEFAULT NULL,
        country VARCHAR(120) DEFAULT NULL,
        timezone VARCHAR(80) DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS organization_admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id INT NOT NULL,
        admin_name VARCHAR(150) DEFAULT NULL,
        admin_title VARCHAR(120) DEFAULT NULL,
        admin_email VARCHAR(150) NOT NULL,
        admin_phone VARCHAR(30) DEFAULT NULL,
        hashed_password VARCHAR(255) DEFAULT NULL,
        reset_token VARCHAR(255) DEFAULT NULL,
        token_expiry DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS organization_plans (
        organization_id INT PRIMARY KEY,
        plan VARCHAR(40) NOT NULL DEFAULT 'trial',
        billing_cycle VARCHAR(40) NOT NULL DEFAULT 'Monthly',
        max_students INT NOT NULL DEFAULT 0,
        max_staff INT NOT NULL DEFAULT 0,
        storage_gb INT NOT NULL DEFAULT 0,
        status VARCHAR(40) NOT NULL DEFAULT 'Active',
        notes TEXT DEFAULT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id VARCHAR(20) DEFAULT NULL UNIQUE,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        roles JSON DEFAULT NULL,
        pages JSON DEFAULT NULL,
        phone VARCHAR(30) DEFAULT NULL,
        designation VARCHAR(120) DEFAULT NULL,
        department VARCHAR(80) DEFAULT NULL,
        employment_type VARCHAR(40) DEFAULT NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'Invited',
        notes TEXT DEFAULT NULL,
        hashed_password VARCHAR(255) DEFAULT NULL,
        reset_token VARCHAR(255) DEFAULT NULL,
        token_expiry DATETIME DEFAULT NULL,
        invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        joined_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS support_tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id INT NOT NULL,
        subject VARCHAR(255) NOT NULL,
        priority VARCHAR(20) NOT NULL DEFAULT 'medium',
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS impersonation_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_name VARCHAR(150) DEFAULT NULL,
        organization_id INT NOT NULL,
        reason VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS feature_flags (
        flag_key VARCHAR(60) PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        description VARCHAR(255) DEFAULT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        scope VARCHAR(100) DEFAULT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS student_directory (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id INT NOT NULL,
        name VARCHAR(150) NOT NULL,
        roll_no VARCHAR(60) DEFAULT NULL,
        program VARCHAR(150) DEFAULT NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'Active',
        email VARCHAR(150) DEFAULT NULL,
        last_active DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE CASCADE
    )
    """,
]

# Same defaults get_feature_flags() already falls back to, seeded once so
# the Platform Settings page has real (editable) rows instead of only ever
# showing the hardcoded fallback.
_DEFAULT_FEATURE_FLAGS = [
    ('exam_engine', 'Online Exam Engine', 'Timed exams, auto-grading, question banks', 1, 'All plans'),
    ('certificates', 'Certificate Generator', 'Auto-generate signed completion certificates', 1, 'Pro & Enterprise'),
    ('fee_module', 'Fee Management', 'Fee structures, receipts, payment reminders', 0, 'Enterprise only'),
    ('alumni_network', 'Alumni Network', 'Alumni directory and engagement tools', 0, 'Beta invite only'),
]


class superadmin_models(controller):
    def __init__(self):
        super().__init__()
        self._ensure_master_schema()

    def _ensure_master_schema(self):
        try:
            for statement in MASTER_TABLE_STATEMENTS:
                self.cur.execute(statement)
            self.cur.execute("SELECT COUNT(*) AS total FROM feature_flags")
            if (self.cur.fetchone() or {}).get("total", 0) == 0:
                self.cur.executemany(
                    """
                    INSERT INTO feature_flags (flag_key, name, description, enabled, scope)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    _DEFAULT_FEATURE_FLAGS,
                )
            self.conn.commit()
        except Exception as e:
            print(f"Error ensuring master (superadmin) schema: {e}")
            self.conn.rollback()

    # ---------------------------------------------------------------
    # Schools (list / detail / create / update / suspend / delete)
    # ---------------------------------------------------------------

    def get_schools(self, search, plan, status):
        try:
            query = """
                SELECT
                    o.organization_id      AS id,
                    o.name                 AS name,
                    o.subdomain            AS subdomain,
                    o.city                 AS city,
                    o.country              AS country,
                    COALESCE(p.plan, 'trial')            AS plan,
                    COALESCE(p.status, 'Pending Setup')  AS status,
                
                    COALESCE(p.max_students, 0)          AS maxStudents,
                    COALESCE(st.student_count, 0)        AS students,

                    COALESCE(p.max_staff, 0)              AS maxStaff,
                    1                                    AS staff,
                    COALESCE(p.storage_gb, 0)             AS storageGb,
                    COALESCE(p.billing_cycle, 'Monthly')  AS billingCycle,
                    a.admin_name            AS adminName,
                    a.admin_email           AS adminEmail,
                    a.admin_phone           AS adminPhone,
                    o.created_at            AS createdAt
                FROM organizations o
                LEFT JOIN organization_plans  p ON p.organization_id = o.organization_id
                LEFT JOIN organization_admins a ON a.organization_id = o.organization_id
                LEFT JOIN (
                    SELECT organization_id, COUNT(*) AS student_count
                    FROM student_directory
                    GROUP BY organization_id
                ) st ON st.organization_id = o.organization_id
                WHERE 1=1
            """
            values = []

            if search:
                query += " AND (o.name LIKE %s OR o.subdomain LIKE %s)"
                values.extend([f"%{search}%", f"%{search}%"])

            if plan:
                query += " AND p.plan = %s"
                values.append(plan)

            if status:
                query += " AND p.status = %s"
                values.append(status)

            query += " ORDER BY o.created_at DESC"

            self.cur.execute(query, values)
            return self.cur.fetchall()

        except Exception as e:
            print(e)
            return None

    def get_school(self, school_id):
        rows = self.get_schools("", "", "")
        if rows is None:
            return None
        return next((row for row in rows if int(row["id"]) == int(school_id)), None)

    def update_school(self, school_id, data):
        try:
            self.cur.execute(
                """
                UPDATE organizations
                SET name=%s, subdomain=%s, type=%s, website=%s, address=%s,
                    city=%s, country=%s, timezone=%s, notes=%s
                WHERE organization_id=%s
                """,
                (
                    data.get("name"), data.get("subdomain"), data.get("type", "College"),
                    data.get("website"), data.get("address"), data.get("city"),
                    data.get("country"), data.get("timezone"), data.get("notes"),
                    school_id,
                ),
            )
            self.cur.execute(
                """
                UPDATE organization_admins
                SET admin_name=%s, admin_title=%s, admin_email=%s, admin_phone=%s
                WHERE organization_id=%s
                """,
                (
                    data.get("adminName"), data.get("adminTitle"),
                    data.get("adminEmail"), data.get("adminPhone"), school_id,
                ),
            )
            self.cur.execute(
                """
                UPDATE organization_plans
                SET plan=%s, billing_cycle=%s, max_students=%s, max_staff=%s,
                    storage_gb=%s, status=%s, notes=%s
                WHERE organization_id=%s
                """,
                (
                    data.get("plan", "trial"), data.get("billingCycle", "Monthly"),
                    data.get("maxStudents", 0), data.get("maxStaff", 0),
                    data.get("storageGb", 0), self._normalize_plan_status(data.get("status", "Active")),
                    data.get("notes"), school_id,
                ),
            )
            self.conn.commit()
            return self.get_school(school_id)
        except Exception as e:
            print(e)
            self.conn.rollback()
            return None

    def set_school_status(self, school_id, status):
        try:
            self.cur.execute(
                "UPDATE organization_plans SET status=%s WHERE organization_id=%s",
                (status, school_id),
            )
            self.conn.commit()
            return self.get_school(school_id)
        except Exception as e:
            print(e)
            self.conn.rollback()
            return None

    def delete_school(self, school_id):
        try:
            self.cur.execute("DELETE FROM organization_admins WHERE organization_id=%s", (school_id,))
            self.cur.execute("DELETE FROM organization_plans WHERE organization_id=%s", (school_id,))
            self.cur.execute("DELETE FROM organizations WHERE organization_id=%s", (school_id,))
            self.conn.commit()
            drop_tenant_database(school_id)   # after commit succeeds
            return True
        except Exception as e:
            print(e)
            self.conn.rollback()
            return False

    def get_school_admins(self, school_id=None):
        try:
            query = """
                SELECT
                    a.id,
                    a.organization_id AS schoolId,
                    o.name AS schoolName,
                    a.admin_name AS adminName,
                    a.admin_title AS adminTitle,
                    a.admin_email AS adminEmail,
                    a.admin_phone AS adminPhone,
                    CASE
                        WHEN a.hashed_password IS NULL THEN 'Invited'
                        ELSE 'Accepted'
                    END AS inviteStatus
                FROM organization_admins a
                JOIN organizations o ON o.organization_id = a.organization_id
                WHERE 1=1
            """
            params = []
            if school_id:
                query += " AND a.organization_id=%s"
                params.append(school_id)
            query += " ORDER BY a.id DESC"
            self.cur.execute(query, params)
            return self.cur.fetchall()
        except Exception as e:
            print(e)
            return None

    def reset_school_admin_invite(self, school_id, token, token_expiry):
        try:
            self.cur.execute(
                """
                UPDATE organization_admins
                SET reset_token=%s, token_expiry=%s
                WHERE organization_id=%s
                """,
                (token, token_expiry, school_id),
            )
            self.conn.commit()
            return self.get_school(school_id)
        except Exception as e:
            print(e)
            self.conn.rollback()
            return None

    def add_school_org(self, data):
        """Create a new college/organization AND provision its own isolated
        database (edureg_org_{organization_id}) with every required table.

        The organization_id (and therefore the database name) only exists
        once the `organizations` row is inserted, so the database name is
        never guessed from the college's name — it's always derived from
        the real auto-increment id after that row is committed.

        If tenant-database provisioning fails, the just-created
        organization/admin/plan rows are deleted again so we never leave a
        college "half onboarded" (visible in the schools list but with no
        working database behind it).
        """
        try:
            ins_query_org = """
                INSERT INTO organizations(name, subdomain, type, website, address, city, country, timezone, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            self.cur.execute(ins_query_org, (
                data.get('name'), data.get('subdomain'), data.get('type'),
                data.get('website'), data.get('address'), data.get('city'),
                data.get('country'), data.get('timezone'), data.get('notes'),
            ))
            organization_id = self.cur.lastrowid
            data['organization_id'] = organization_id

            ins_query_admin = """
                INSERT INTO organization_admins(admin_name, organization_id, admin_title, admin_email, admin_phone, reset_token, token_expiry)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            self.cur.execute(ins_query_admin, (
                data.get('adminName'), organization_id, data.get('adminTitle'),
                data.get('adminEmail'), data.get('adminPhone'),data.get('reset_token'), data.get('token_expiry'),
            ))
              
            ins_query_plan = """
                INSERT INTO organization_plans(organization_id, plan, billing_cycle, max_students, max_staff, storage_gb, status, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            self.cur.execute(ins_query_plan, (
                organization_id, data.get('plan', 'trial'), data.get('billingCycle', 'Monthly'),
                data.get('maxStudents', 0), data.get('maxStaff', 0), data.get('storageGb', 0),
                self._normalize_plan_status(data.get('status', 'Active')), data.get('notes'), 
            ))

            self.conn.commit()

        except Exception as e:
            print(e)
            self.conn.rollback()
            return jsonify({"error": "Failed to add school organization"}), 500

        # Organization row is committed and durable at this point, so we
        # know the real organization_id. Now provision that college's own
        # database + tables.
        try:
            db_name = create_tenant_database(organization_id)
            data['db_name'] = db_name
            return True

        except Exception as e:
            print(f"Failed to provision tenant database for organization {organization_id}: {e}")
            # Don't leave a college listed with no working database behind
            # it — undo the rows we just committed.
            try:
                self.cur.execute("DELETE FROM organization_plans WHERE organization_id=%s", (organization_id,))
                self.cur.execute("DELETE FROM organization_admins WHERE organization_id=%s", (organization_id,))
                self.cur.execute("DELETE FROM organizations WHERE organization_id=%s", (organization_id,))
                self.conn.commit()
            except Exception as cleanup_error:
                print(f"Failed to clean up organization {organization_id} after provisioning failure: {cleanup_error}")
                self.conn.rollback()
            return jsonify({"error": "Failed to provision database for school organization"}), 500

    
    

    # ---------------------------------------------------------------
    # Dashboard
    # ---------------------------------------------------------------

    def get_stats(self):
        try:
            self.cur.execute("SELECT COUNT(*) AS c FROM organizations")
            total_schools = self.cur.fetchone()['c']

            self.cur.execute(
                "SELECT status, COUNT(*) AS c FROM organization_plans GROUP BY status"
            )
            by_status = {row['status']: row['c'] for row in self.cur.fetchall()}

            # "Trial" is a plan, not a status (status is Active/Inactive/Suspended/
            # Pending Setup), so it must be counted from organization_plans.plan —
            # counting it via `status` above always returned 0.
            self.cur.execute(
                """
                SELECT COUNT(*) AS c FROM organizations o
                LEFT JOIN organization_plans p ON p.organization_id = o.organization_id
                WHERE COALESCE(p.plan, 'trial') = 'trial'
                """
            )
            trial_schools = self.cur.fetchone()['c']

            self.cur.execute("SELECT COUNT(*) AS c FROM student_directory")
            total_students = self.cur.fetchone()['c']

            self.cur.execute(
                "SELECT COALESCE(SUM(max_staff),0) AS t FROM organization_plans"
            )
            totals = self.cur.fetchone()

            self.cur.execute(
                "SELECT plan, COUNT(*) AS c FROM organization_plans WHERE status='Active' GROUP BY plan"
            )
            active_by_plan = {row['plan']: row['c'] for row in self.cur.fetchall()}
            mrr = sum(PLAN_PRICES.get(plan, 0) * count for plan, count in active_by_plan.items())

            self.cur.execute(
                "SELECT COUNT(*) AS c FROM organizations WHERE created_at >= DATE_FORMAT(NOW(), '%%Y-%%m-01')"
            )
            new_this_month = self.cur.fetchone()['c']

            return {
                "totalSchools": int(total_schools or 0),
                "activeSchools": int(by_status.get('Active', 0) or 0),
                "trialSchools": int(trial_schools or 0),
                "suspendedSchools": int(by_status.get('Suspended', 0) or 0),
                "totalStudents": int(total_students or 0),
                "totalStaff": int(totals['t'] or 0),
                "mrr": int(mrr or 0),
                "newThisMonth": int(new_this_month or 0),
            }
        except Exception as e:
            print(e)
            return None

    def get_revenue(self):
        try:
            self.cur.execute("SELECT plan, COUNT(*) AS schools FROM organization_plans GROUP BY plan")
            rows = self.cur.fetchall()
            by_plan = []
            mrr = 0
            for row in rows:
                plan = (row.get("plan") or "trial").lower()
                amount = PLAN_PRICES.get(plan, 0) * row["schools"]
                mrr += amount
                by_plan.append({
                    "plan": plan.title(),
                    "amount": amount,
                    "schools": row["schools"],
                })
            return {
                "mrr": mrr,
                "mrrGrowthPct": 0,
                "renewalsDueThisMonth": 0,
                "churnedThisMonth": 0,
                "byPlan": by_plan,
            }
        except Exception as e:
            print(e)
            return None

    def get_onboarding(self):
        try:
            self.cur.execute(
                """
                SELECT o.organization_id AS id, o.name, o.city,
                       CASE
                         WHEN p.status='Active' THEN 'Active'
                         WHEN a.hashed_password IS NULL THEN 'Invited'
                         WHEN p.status='Suspended' THEN 'Verifying'
                         ELSE 'Setup'
                       END AS stage,
                       o.created_at AS updatedAt
                FROM organizations o
                LEFT JOIN organization_plans p ON p.organization_id=o.organization_id
                LEFT JOIN organization_admins a ON a.organization_id=o.organization_id
                ORDER BY o.created_at DESC
                """
            )
            rows = self.cur.fetchall()
            for row in rows:
                row["updatedAgo"] = self._time_ago(row.pop("updatedAt", None))
            return rows
        except Exception as e:
            print(e)
            return None

    def get_api_usage(self):
        try:
            schools = self.get_schools("", "", "") or []
            usage = []
            for school in schools:
                max_students = school.get("maxStudents") or 1
                storage_gb = school.get("storageGb") or 1
                storage_pct = min(100, round((school.get("students", 0) / max_students) * 100))
                usage.append({
                    "schoolName": school.get("name"),
                    "apiCallsToday": 0,
                    "storagePct": storage_pct if storage_gb else 0,
                    "rateLimitHits": 0,
                })
            return usage
        except Exception as e:
            print(e)
            return None

    def get_activity_log(self, limit=20):
        try:
            self.cur.execute(
                """
                SELECT name, created_at
                FROM organizations
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (int(limit),),
            )
            rows = self.cur.fetchall()
            return [
                {
                    "type": "create",
                    "text": f"{row['name']} onboarded",
                    "time": self._time_ago(row.get("created_at")),
                }
                for row in rows
            ]
        except Exception as e:
            print(e)
            return []


    def add_employee(self, data):
        try:
            query = """
                INSERT INTO employees
                (name, email, roles, pages, phone, designation,
                department, employment_type, status, notes,reset_token, token_expiry)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """

            # Convert lists to JSON strings if necessary
            roles = data.get("roles")
            if isinstance(roles, list):
                roles = json.dumps(roles)

            pages = data.get("pages")
            if isinstance(pages, list):
                pages = json.dumps(pages)

            self.cur.execute(query, (
                data.get("name"),
                data.get("email"),
                roles,
                pages,
                data.get("phone"),
                data.get("designation"),
                data.get("department"),
                data.get("employmentType"),   # JSON key
                data.get("status"),
                data.get("notes"),
                data.get("invite_token"),
                data.get("token_expiry")
            ))
            emp_id = self.cur.lastrowid
            employee_id = f"EDUREG{emp_id:05d}"

            update_query = """
                UPDATE employees
                SET employee_id = %s
                WHERE id = %s
            """

            self.cur.execute(update_query, (employee_id, emp_id))

            self.conn.commit()
            return True

        except Exception as e:
            print("Database Error:", e)
            self.conn.rollback()
            return None


    def get_employees(self, search="", department="", role="", status=""):
        query = "SELECT * FROM employees WHERE 1=1"
        params = []
        if search:
            query += " AND (name LIKE %s OR email LIKE %s OR employee_id LIKE %s)"
            params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])
        if department:
            query += " AND department=%s"
            params.append(department)
        if status:
            query += " AND status=%s"
            params.append(status)
        if role:
            query += " AND JSON_CONTAINS(roles, JSON_QUOTE(%s))"
            params.append(role)
        query += " ORDER BY created_at DESC"
        self.cur.execute(query, params)
        rows = self.cur.fetchall()   # already a list of dicts

        for emp in rows:
            for field in ("roles", "pages"):
                value = emp.get(field)
                if value and isinstance(value, str) and value.strip():
                    try:
                        emp[field] = json.loads(value)
                    except (TypeError, ValueError):
                        emp[field] = [value]
                else:
                    emp[field] = []
            emp["employeeId"] = emp.pop("employee_id", None)
            emp["type"] = emp.pop("employment_type", None)
            emp["invitedAgo"] = self._time_ago(emp.get("invited_at") or emp.get("created_at"))
            emp["joinedAt"] = self._time_ago(emp.get("joined_at")) if emp.get("joined_at") else None
            for private_field in ("hashed_password", "reset_token", "token_expiry"):
                emp.pop(private_field, None)

        return rows

    def get_employee(self, employee_id):
        rows = self.get_employees()
        return next((row for row in rows if int(row["id"]) == int(employee_id)), None)

    def update_employee(self, employee_id, data):
        try:
            roles = data.get("roles", [])
            pages = data.get("pages", [])
            if isinstance(roles, list):
                roles = json.dumps(roles)
            if isinstance(pages, list):
                pages = json.dumps(pages)
            self.cur.execute(
                """
                UPDATE employees
                SET name=%s, email=%s, roles=%s, pages=%s, phone=%s,
                    designation=%s, department=%s, employment_type=%s,
                    status=%s, notes=%s
                WHERE id=%s
                """,
                (
                    data.get("name"), data.get("email"), roles, pages,
                    data.get("phone"), data.get("designation"),
                    data.get("department"), data.get("employmentType") or data.get("type"),
                    data.get("status"), data.get("notes"), employee_id,
                ),
            )
            self.conn.commit()
            return self.get_employee(employee_id)
        except Exception as e:
            print(e)
            self.conn.rollback()
            return None

    def set_employee_status(self, employee_id, status):
        try:
            self.cur.execute("UPDATE employees SET status=%s WHERE id=%s", (status, employee_id))
            self.conn.commit()
            return self.get_employee(employee_id)
        except Exception as e:
            print(e)
            self.conn.rollback()
            return None

    def delete_employee(self, employee_id):
        try:
            self.cur.execute("DELETE FROM employees WHERE id=%s", (employee_id,))
            self.conn.commit()
            return True
        except Exception as e:
            print(e)
            self.conn.rollback()
            return False

    def reset_employee_invite(self, employee_id, token, token_expiry):
        try:
            self.cur.execute(
                "UPDATE employees SET reset_token=%s, token_expiry=%s, status='Invited' WHERE id=%s",
                (token, token_expiry, employee_id),
            )
            self.conn.commit()
            return self.get_employee(employee_id)
        except Exception as e:
            print(e)
            self.conn.rollback()
            return None

    def get_feature_flags(self):
        try:
            self.cur.execute(
                "SELECT flag_key AS `key`, name, description AS `desc`, enabled, scope FROM feature_flags ORDER BY name"
            )
            rows = self.cur.fetchall()
            if rows:
                for row in rows:
                    row["enabled"] = bool(row["enabled"])
                return rows
        except Exception as e:
            print(e)
        # feature_flags table missing/empty — fall back to platform defaults.
        return [
            {"key": "exam_engine", "name": "Online Exam Engine", "desc": "Timed exams, auto-grading, question banks", "enabled": True, "scope": "All plans"},
            {"key": "certificates", "name": "Certificate Generator", "desc": "Auto-generate signed completion certificates", "enabled": True, "scope": "Pro & Enterprise"},
            {"key": "fee_module", "name": "Fee Management", "desc": "Fee structures, receipts, payment reminders", "enabled": False, "scope": "Enterprise only"},
            {"key": "alumni_network", "name": "Alumni Network", "desc": "Alumni directory and engagement tools", "enabled": False, "scope": "Beta invite only"},
        ]

    def update_feature_flag(self, key, enabled):
        try:
            self.cur.execute(
                "UPDATE feature_flags SET enabled=%s WHERE flag_key=%s",
                (1 if enabled else 0, key),
            )
            self.conn.commit()
            self.cur.execute(
                "SELECT flag_key AS `key`, name, description AS `desc`, enabled, scope FROM feature_flags WHERE flag_key=%s",
                (key,),
            )
            row = self.cur.fetchone()
            if row:
                row["enabled"] = bool(row["enabled"])
                return row
            return {"key": key, "enabled": bool(enabled)}
        except Exception as e:
            print(e)
            self.conn.rollback()
            return None

    # ---------------------------------------------------------------
    # Students (cross-tenant, read-only directory synced from schools)
    # ---------------------------------------------------------------

    def get_students(self, search="", school_id="", status="", plan=""):
        try:
            query = """
                SELECT
                    st.id                AS id,
                    st.name              AS name,
                    st.roll_no           AS rollNo,
                    st.organization_id   AS schoolId,
                    o.name               AS schoolName,
                    st.program           AS program,
                    st.status            AS status,
                    st.email             AS email,
                    st.last_active       AS lastActiveRaw,
                    st.created_at        AS enrolledRaw
                FROM student_directory st
                JOIN organizations o ON o.organization_id = st.organization_id
                LEFT JOIN organization_plans p ON p.organization_id = st.organization_id
                WHERE 1=1
            """
            values = []
            if search:
                query += " AND (st.name LIKE %s OR st.roll_no LIKE %s OR st.email LIKE %s)"
                values.extend([f"%{search}%", f"%{search}%", f"%{search}%"])
            if school_id:
                query += " AND st.organization_id = %s"
                values.append(school_id)
            if status:
                query += " AND st.status = %s"
                values.append(status)
            if plan:
                query += " AND p.plan = %s"
                values.append(plan)
            query += " ORDER BY st.created_at DESC"

            self.cur.execute(query, values)
            rows = self.cur.fetchall()
            for row in rows:
                row["lastActive"] = self._time_ago(row.pop("lastActiveRaw", None))
                row["enrolled"] = self._time_ago(row.pop("enrolledRaw", None))
            return rows
        except Exception as e:
            print(e)
            return None

    def get_student(self, student_id):
        rows = self.get_students()
        if rows is None:
            return None
        return next((row for row in rows if int(row["id"]) == int(student_id)), None)

    # ---------------------------------------------------------------
    # Support tickets
    # ---------------------------------------------------------------

    def get_tickets(self, status="", priority="", school_id=""):
        try:
            query = """
                SELECT
                    t.id               AS id,
                    t.subject          AS subject,
                    t.organization_id  AS schoolId,
                    o.name             AS schoolName,
                    t.priority         AS priority,
                    t.status           AS status,
                    t.updated_at       AS updatedAtRaw
                FROM support_tickets t
                JOIN organizations o ON o.organization_id = t.organization_id
                WHERE 1=1
            """
            values = []
            if status:
                query += " AND t.status = %s"
                values.append(status)
            if priority:
                query += " AND t.priority = %s"
                values.append(priority)
            if school_id:
                query += " AND t.organization_id = %s"
                values.append(school_id)
            query += " ORDER BY t.updated_at DESC"

            self.cur.execute(query, values)
            rows = self.cur.fetchall()
            for row in rows:
                row["updatedAgo"] = self._time_ago(row.pop("updatedAtRaw", None))
            return rows
        except Exception as e:
            print(e)
            return None

    def update_ticket_status(self, ticket_id, status):
        try:
            self.cur.execute(
                "UPDATE support_tickets SET status=%s, updated_at=NOW() WHERE id=%s",
                (status, ticket_id),
            )
            self.conn.commit()
            self.cur.execute(
                "SELECT id, subject, status FROM support_tickets WHERE id=%s", (ticket_id,)
            )
            return self.cur.fetchone()
        except Exception as e:
            print(e)
            self.conn.rollback()
            return None

    # ---------------------------------------------------------------
    # Impersonation audit log
    # ---------------------------------------------------------------

    def log_impersonation(self, employee_name, school_id, reason="Support session"):
        try:
            self.cur.execute(
                """
                INSERT INTO impersonation_log (employee_name, organization_id, reason, created_at)
                VALUES (%s, %s, %s, NOW())
                """,
                (employee_name, school_id, reason),
            )
            self.conn.commit()
            return True
        except Exception as e:
            print(e)
            self.conn.rollback()
            return False

    def get_impersonation_log(self, limit=50):
        try:
            self.cur.execute(
                """
                SELECT l.employee_name AS admin, o.name AS schoolName, l.reason AS reason, l.created_at AS timeRaw
                FROM impersonation_log l
                JOIN organizations o ON o.organization_id = l.organization_id
                ORDER BY l.created_at DESC
                LIMIT %s
                """,
                (int(limit),),
            )
            rows = self.cur.fetchall()
            for row in rows:
                row["time"] = self._time_ago(row.pop("timeRaw", None))
            return rows
        except Exception as e:
            print(e)
            return []

    # ---------------------------------------------------------------
    # Notifications / broadcasts
    # ---------------------------------------------------------------

    def get_notifications(self):
        try:
            self.cur.execute(
                "SELECT title, body, audience, created_at AS sentAtRaw FROM notifications ORDER BY created_at DESC"
            )
            rows = self.cur.fetchall()
            for row in rows:
                row["sentAgo"] = self._time_ago(row.pop("sentAtRaw", None))
            return rows
        except Exception as e:
            print(e)
            return []

    def create_notification(self, data):
        try:
            audience = data.get("audience", "All schools")
            self.cur.execute(
                "INSERT INTO notifications (title, body, audience, created_at) VALUES (%s, %s, %s, NOW())",
                (data.get("title"), data.get("body"), audience),
            )
            self.conn.commit()
            return {"title": data.get("title"), "audience": audience, "sentAgo": "just now"}
        except Exception as e:
            print(e)
            self.conn.rollback()
            return None

    def _time_ago(self, value):
        if not value:
            return ""
        if isinstance(value, str):
            try:
                value = datetime.fromisoformat(value)
            except ValueError:
                return value
        diff = datetime.now() - value.replace(tzinfo=None)
        minutes = int(diff.total_seconds() // 60)
        if minutes < 1:
            return "just now"
        if minutes < 60:
            return f"{minutes}m ago"
        hours = minutes // 60
        if hours < 24:
            return f"{hours}h ago"
        return f"{hours // 24}d ago"

    def _normalize_plan_status(self, status):
        if status == "Trial":
            return "Active"
        if status in ("Active", "Inactive", "Suspended"):
            return status
        return "Active"