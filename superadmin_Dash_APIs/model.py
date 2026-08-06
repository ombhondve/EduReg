import re, json
from datetime import datetime
from flask import jsonify
from shared.model import controller

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


class superadmin_models(controller):
    def __init__(self):
        super().__init__()

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
                    FROM students
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

    def add_school_org(self, data, DB_name):
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
            #self.create_resources(organization_id)
            return True
            #return jsonify({"message": "School organization added successfully", "id": organization_id}), 201

        except Exception as e:
            print(e)
            self.conn.rollback()
            return jsonify({"error": "Failed to add school organization"}), 500

    
    

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

            self.cur.execute("SELECT COUNT(*) AS c FROM students")
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
                FROM students st
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
