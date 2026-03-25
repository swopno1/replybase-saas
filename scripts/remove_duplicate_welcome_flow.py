#!/usr/bin/env python3

import psycopg2

DB_URL = "postgres://postgres:2b1HcgrA4TZHQ7L8MPsCwUAM9QbFafetMu0agPoAk4onrILLZb1kKjVeVyKaAHFL@104.248.160.102:5432/replybase_saas"
DUPLICATE_FLOW_ID = "cmmxt2b870000z71vlfppxqvf"
CANONICAL_FLOW_ID = "cf72704abd9d8ec22e90d23f"


def main() -> None:
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        cur.execute(
            'SELECT count(*) FROM flow_sessions WHERE "flowId" = %s',
            (DUPLICATE_FLOW_ID,),
        )
        session_count = cur.fetchone()[0]

        cur.execute(
            'UPDATE flow_sessions SET "flowId" = %s, "updatedAt" = NOW() WHERE "flowId" = %s',
            (CANONICAL_FLOW_ID, DUPLICATE_FLOW_ID),
        )
        sessions_migrated = cur.rowcount

        cur.execute(
            'DELETE FROM flow_nodes WHERE "flowId" = %s',
            (DUPLICATE_FLOW_ID,),
        )
        flow_nodes_deleted = cur.rowcount

        cur.execute('DELETE FROM flows WHERE id = %s', (DUPLICATE_FLOW_ID,))
        flows_deleted = cur.rowcount

        conn.commit()
        print(
            {
                "sessions_before": session_count,
                "sessions_migrated": sessions_migrated,
                "flow_nodes_deleted": flow_nodes_deleted,
                "flows_deleted": flows_deleted,
            }
        )
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
