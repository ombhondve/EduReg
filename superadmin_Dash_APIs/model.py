import re
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
                   
                    COALESCE(p.max_staff, 0)              AS maxStaff,
                    a.admin_name            AS adminName,
                    a.admin_email           AS adminEmail,
                    a.admin_phone           AS adminPhone,
                    o.created_at            AS createdAt
                FROM organizations o
                LEFT JOIN organization_plans  p ON p.organization_id = o.organization_id
                LEFT JOIN organization_admins a ON a.organization_id = o.organization_id
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
                data.get('status', 'Trial'), data.get('notes'), 
            ))

            self.conn.commit()
            self.create_resources(organization_id)
            return True
            #return jsonify({"message": "School organization added successfully", "id": organization_id}), 201

        except Exception as e:
            print(e)
            self.conn.rollback()
            return jsonify({"error": "Failed to add school organization"}), 500

    
    def create_resources(self, organization_id):
           # Identifiers can't be parameterized in SQL — build one ourselves and
           # validate it's alphanumeric/underscore only before using it in DDL.
           DB_name = f"edureg_org_{organization_id}"
           if not _SAFE_IDENT.match(DB_name):
               raise ValueError(f"Unsafe database identifier: {DB_name}")
           self.cur.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_name}`")
           self.conn.commit()
           return True

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

            self.cur.execute(
                "SELECT COALESCE(SUM(current_students),0) AS s, COALESCE(SUM(current_staff),0) AS t FROM organization_plans"
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
                "totalSchools": total_schools,
                "activeSchools": by_status.get('Active', 0),
                "trialSchools": by_status.get('Trial', 0),
                "suspendedSchools": by_status.get('Suspended', 0),
                "totalStudents": totals['s'],
                "totalStaff": totals['t'],
                "mrr": mrr,
                "newThisMonth": new_this_month,
            }
        except Exception as e:
            print(e)
            return None


