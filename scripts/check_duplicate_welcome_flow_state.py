#!/usr/bin/env python3

import psycopg2
import psycopg2.extras

DB_URL = "postgres://postgres:2b1HcgrA4TZHQ7L8MPsCwUAM9QbFafetMu0agPoAk4onrILLZb1kKjVeVyKaAHFL@104.248.160.102:5432/replybase_saas"
FLOW_IDS = ["cmmxt2b870000z71vlfppxqvf", "cf72704abd9d8ec22e90d23f"]


def main() -> None:
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute(
        'SELECT id, name, "tenantId" FROM flows WHERE id = ANY(%s) ORDER BY id',
        (FLOW_IDS,),
    )
    print("flows:")
    for row in cur.fetchall():
        print(dict(row))

    cur.execute(
        '''
        SELECT fs.id, fs."flowId", f.name AS flow_name, fs."isActive", fs."completedAt"
        FROM flow_sessions fs
        JOIN flows f ON f.id = fs."flowId"
        ORDER BY fs."createdAt"
        '''
    )
    print("flow_sessions:")
    for row in cur.fetchall():
        print(dict(row))

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
