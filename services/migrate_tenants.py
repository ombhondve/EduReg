# services/migrate_tenants.py
#
# One-time (but safe to re-run) repair script for every EXISTING tenant
# database. Run this after pulling a change to TENANT_TABLE_STATEMENTS in
# tenant_provisioning.py (e.g. adding the `grades` table, renaming
# `fees` -> `fee_records`) so all of your already-provisioned colleges
# (edureg_org_1 ... edureg_org_50, however many you have) get repaired in
# one go, instead of you hand-editing each database.
#
# What it does, per organization:
#   1. Renames the old `fees` table to `fee_records` if the old name is
#      still there and the new one isn't yet (this is what was causing
#      "Unknown column 'created_at' in 'order clause'": some tenant DBs had
#      an old/hand-created `fee_records` table missing that column).
#   2. Adds `created_at` to `fee_records` if the table exists but that
#      column doesn't (belt-and-suspenders for step 1, and for anyone who
#      created the table manually).
#   3. Calls create_tenant_database() to (re)run every CREATE TABLE IF NOT
#      EXISTS statement — this is what actually adds `grades` (or any
#      future new table) to a database that predates it. Safe/idempotent:
#      it does nothing to tables that already match.
#
# Usage:
#   python -m services.migrate_tenants            # repairs every org found
#                                                   # in the `organizations`
#                                                   # table (central DB)
#   python -m services.migrate_tenants 12 13 19    # repairs only these
#                                                   # organization ids
#
# Safe to run more than once — every step is idempotent.

import sys
import os

import pymysql
from pymysql import cursors

from services.tenant_provisioning import create_tenant_database, tenant_db_name


def _admin_connection():
    return pymysql.connect(
        host=os.getenv("host"),
        user=os.getenv("user"),
        password=os.getenv("password"),
        cursorclass=cursors.DictCursor,
        autocommit=False,
    )


def _all_organization_ids():
    """Pulls every org id from the central `organizations` table (the same
    database shared/model.py's `controller` connects to via the `database`
    env var)."""
    conn = pymysql.connect(
        host=os.getenv("host"),
        user=os.getenv("user"),
        password=os.getenv("password"),
        database=os.getenv("database"),
        cursorclass=cursors.DictCursor,
        autocommit=True,
    )
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT organization_id FROM organizations ORDER BY organization_id")
            return [row["organization_id"] for row in cur.fetchall()]
    finally:
        conn.close()


def _column_exists(cur, table, column):
    cur.execute(
        """
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = %s AND column_name = %s
        """,
        (table, column),
    )
    return (cur.fetchone() or {}).get("c", 0) > 0


def _table_exists(cur, table):
    cur.execute(
        """
        SELECT COUNT(*) AS c FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = %s
        """,
        (table,),
    )
    return (cur.fetchone() or {}).get("c", 0) > 0


def repair_tenant(organization_id):
    """Repairs one college's database. Returns a short status string per
    step so you can see exactly what happened (or that nothing needed
    fixing)."""
    db_name = tenant_db_name(organization_id)
    notes = []
    conn = _admin_connection()
    try:
        # Database might not exist at all yet for this org — let
        # create_tenant_database create it fresh further down, but guard
        # the rename/column steps (which need an existing DB) here.
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS c FROM information_schema.schemata WHERE schema_name = %s",
                (db_name,),
            )
            db_exists = (cur.fetchone() or {}).get("c", 0) > 0

        if db_exists:
            conn.select_db(db_name)
            with conn.cursor() as cur:
                has_fees = _table_exists(cur, "fees")
                has_fee_records = _table_exists(cur, "fee_records")

                if has_fees and not has_fee_records:
                    cur.execute("RENAME TABLE fees TO fee_records")
                    notes.append("renamed fees -> fee_records")
                    has_fee_records = True

                if has_fee_records and not _column_exists(cur, "fee_records", "created_at"):
                    cur.execute(
                        "ALTER TABLE fee_records "
                        "ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
                    )
                    notes.append("added fee_records.created_at")
            conn.commit()
    except Exception as e:
        conn.rollback()
        notes.append(f"ERROR during repair step: {e}")
    finally:
        conn.close()

    # Re-run full provisioning last: creates the DB if it didn't exist,
    # and adds any table (grades, etc.) that's missing. IF NOT EXISTS makes
    # this a no-op for anything already correct.
    try:
        create_tenant_database(organization_id)
        notes.append("schema verified (create_tenant_database)")
    except Exception as e:
        notes.append(f"ERROR in create_tenant_database: {e}")

    return notes


def main(org_ids=None):
    if org_ids is None:
        org_ids = _all_organization_ids()
        print(f"No org ids given — found {len(org_ids)} organizations in the central DB.")

    print(f"Repairing {len(org_ids)} tenant database(s)...\n")
    failures = []
    for org_id in org_ids:
        db_name = tenant_db_name(org_id)
        print(f"[{db_name}]")
        notes = repair_tenant(org_id)
        for note in notes:
            print(f"  - {note}")
            if note.startswith("ERROR"):
                failures.append((org_id, note))
        print()

    print("Done.")
    if failures:
        print(f"\n{len(failures)} organization(s) hit an error and may need a look:")
        for org_id, note in failures:
            print(f"  org {org_id}: {note}")
        sys.exit(1)


if __name__ == "__main__":
    ids = [int(a) for a in sys.argv[1:]] if len(sys.argv) > 1 else None
    main(ids)
