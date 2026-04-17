"""
Remove all Facebook-related data for the user replybase1@gmail.com.

What this script does:
  1. Finds the user + tenant for replybase1@gmail.com
  2. Deletes all facebook_pages for that tenant (with dependent records)
  3. Removes the 'facebook' OAuth account (provider='facebook') from accounts table
  4. Removes any 'facebook' type channels from bots owned by that tenant
  5. Sets tenant_channel_statuses.facebook = false
  6. Removes any flow_assignments linked to those pages
  7. Removes any onboarding_sessions linked to those pages
  8. Removes any leads linked to those pages
"""

import os
import sys
import psycopg2
import psycopg2.extras
from pathlib import Path

# ── Load DATABASE_URL from .env ────────────────────────────────────────────────
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in .env")
    sys.exit(1)

TARGET_EMAIL = "replybase1@gmail.com"


def run(conn, sql: str, params=None, label: str = ""):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params)
        try:
            rows = cur.fetchall()
        except psycopg2.ProgrammingError:
            rows = []
    if label:
        print(f"  {label}: {len(rows)} row(s)")
    return rows


def main():
    print(f"\n=== Facebook Data Cleanup for {TARGET_EMAIL} ===\n")

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False

    try:
        # ── 1. Find user + tenant ──────────────────────────────────────────────
        rows = run(conn, 'SELECT id, "tenantId" FROM users WHERE email = %s', (TARGET_EMAIL,))
        if not rows:
            print(f"No user found with email {TARGET_EMAIL}. Nothing to do.")
            conn.rollback()
            return

        user_id   = rows[0]["id"]
        tenant_id = rows[0]["tenantId"]
        print(f"Found user:   {user_id}")
        print(f"Found tenant: {tenant_id}\n")

        # ── 2. Find all Facebook pages for this tenant ─────────────────────────
        pages = run(conn, 'SELECT id, name, "facebookId" FROM facebook_pages WHERE "tenantId" = %s', (tenant_id,))
        page_ids = [p["id"] for p in pages]
        print(f"Facebook pages found: {len(pages)}")
        for p in pages:
            print(f"  - {p['name']} (id={p['id']}, facebookId={p['facebookId']})")

        if page_ids:
            fmt = ",".join(["%s"] * len(page_ids))

            # Delete flow_assignments
            with conn.cursor() as cur:
                cur.execute(f'DELETE FROM flow_assignments WHERE "pageId" IN ({fmt})', page_ids)
                print(f"  Deleted flow_assignments: {cur.rowcount}")

            # Delete flow_sessions referencing these pages
            with conn.cursor() as cur:
                cur.execute(f'DELETE FROM flow_sessions WHERE "pageId" IN ({fmt})', page_ids)
                print(f"  Deleted flow_sessions: {cur.rowcount}")

            # Delete onboarding_sessions
            with conn.cursor() as cur:
                cur.execute(f'DELETE FROM onboarding_sessions WHERE "facebookPageId" IN ({fmt})', page_ids)
                print(f"  Deleted onboarding_sessions: {cur.rowcount}")

            # Delete leads
            with conn.cursor() as cur:
                cur.execute(f'DELETE FROM leads WHERE "pageId" IN ({fmt})', page_ids)
                print(f"  Deleted leads (FB page-linked): {cur.rowcount}")

            # Nullify facebookPageId on crm_conversations (keep conversations, just unlink)
            with conn.cursor() as cur:
                cur.execute(
                    f'UPDATE crm_conversations SET "facebookPageId" = NULL WHERE "facebookPageId" IN ({fmt})',
                    page_ids,
                )
                print(f"  Unlinked crm_conversations from FB page: {cur.rowcount}")

            # Delete the facebook_pages rows
            with conn.cursor() as cur:
                cur.execute(f'DELETE FROM facebook_pages WHERE id IN ({fmt})', page_ids)
                print(f"  Deleted facebook_pages: {cur.rowcount}")

        # ── 3. Remove Facebook OAuth account link ──────────────────────────────
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM accounts WHERE \"userId\" = %s AND provider = 'facebook'",
                (user_id,),
            )
            print(f"\n  Deleted Facebook OAuth account entries: {cur.rowcount}")

        # ── 4. Remove facebook-type channels from this tenant's bots ──────────
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM channels
                WHERE type = 'facebook'
                  AND "botId" IN (SELECT id FROM bots WHERE "tenantId" = %s)
                """,
                (tenant_id,),
            )
            print(f"  Deleted facebook channels: {cur.rowcount}")

        # ── 5. Set tenant_channel_statuses.facebook = false ────────────────────
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE tenant_channel_statuses SET facebook = false WHERE "tenantId" = %s',
                (tenant_id,),
            )
            print(f"  Reset tenant_channel_statuses.facebook: {cur.rowcount}")

        # ── Commit ─────────────────────────────────────────────────────────────
        conn.commit()
        print("\n✅ Facebook data cleanup committed successfully.")

        # ── Summary ────────────────────────────────────────────────────────────
        print("\n=== Final Verification ===")
        remaining = run(
            conn,
            'SELECT COUNT(*) AS count FROM facebook_pages WHERE "tenantId" = %s',
            (tenant_id,),
        )
        print(f"  facebook_pages remaining for tenant: {remaining[0]['count']}")

        fb_accounts = run(
            conn,
            "SELECT COUNT(*) AS count FROM accounts WHERE \"userId\" = %s AND provider = 'facebook'",
            (user_id,),
        )
        print(f"  Facebook OAuth accounts remaining: {fb_accounts[0]['count']}")

        fb_channels = run(
            conn,
            """
            SELECT COUNT(*) AS count FROM channels
            WHERE type = 'facebook'
              AND "botId" IN (SELECT id FROM bots WHERE "tenantId" = %s)
            """,
            (tenant_id,),
        )
        print(f"  Facebook channels remaining: {fb_channels[0]['count']}")

    except Exception as e:
        conn.rollback()
        print(f"\n❌ ERROR: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
