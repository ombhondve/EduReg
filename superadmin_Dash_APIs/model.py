from flask import jsonify, request
from shared.model import controller
class superadmin_models(controller):
    def __init__(self):
        super().__init__()

    def add_school_org(self, data):
        try:
            ins_query_org="""
            INSERT INTO organizations(name, subdomain, type, website, address, city, country, timezone, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)"""  
            self.cur.execute(ins_query_org, (data['name'], data['subdomain'], data['type'], data['website'], data['address'], data['city'], data['country'], data['timezone'], data['notes']))
            data['organization_id'] = self.cur.lastrowid
            ins_query_sch_admin="""
            INSERT INTO organization_admins(admin_name, organization_id, admin_title, admin_email, admin_phone)
            VALUES (%s, %s, %s, %s, %s)"""
            self.cur.execute(ins_query_sch_admin, (data['adminName'], data['organization_id'], data['adminTitle'], data['adminEmail'], data['adminPhone']))
            ins_query_org_plan="""
            INSERT INTO organization_plans( organization_id, plan, billing_cycle, max_students, max_staff, storage_gb, status, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"""
            self.cur.execute(ins_query_org_plan, (data['organization_id'], data['plan'], data['billingCycle'], data['maxStudents'], data['maxStaff'], data['storageGb'], data['status'],data['notes']))
            self.conn.commit()
            return jsonify({"message": "School organization added successfully"}), 201
        except Exception as e:
            print(e)
            self.conn.rollback()
            return jsonify({"error": "Failed to add school organization"}), 500    