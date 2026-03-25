#!/usr/bin/env python3
"""Add export const dynamic = 'force-dynamic' to all page.tsx files missing it."""
import re, subprocess, os

DIRECTIVE = "export const dynamic = 'force-dynamic';"
BASE = "/Users/mdamirhossain/ViveScript-Solutions/projects/ReplyBase/replybase-saas/app"


def last_import_line(lines):
    last = -1
    in_import = False
    depth = 0
    for i, line in enumerate(lines):
        s = line.strip()
        if not in_import and s.startswith("import "):
            in_import = True
            depth += s.count("{") - s.count("}")
            if depth <= 0 and s.endswith(";"):
                last = i
                in_import = False
                depth = 0
        elif in_import:
            depth += s.count("{") - s.count("}")
            if depth <= 0 and s.endswith(";"):
                last = i
                in_import = False
                depth = 0
    return last


result = subprocess.run(
    ["find", BASE, "-name", "page.tsx"],
    capture_output=True, text=True
)
all_pages = [p.strip() for p in result.stdout.strip().split("\n") if p.strip()]

patched = 0
skipped = 0

for filepath in sorted(all_pages):
    with open(filepath) as f:
        content = f.read()

    if DIRECTIVE in content or 'export const dynamic = "force-dynamic"' in content:
        skipped += 1
        continue

    lines = content.split("\n")
    idx = last_import_line(lines)

    if idx >= 0:
        lines.insert(idx + 1, "")
        lines.insert(idx + 2, DIRECTIVE)
    else:
        lines.insert(0, DIRECTIVE)
        lines.insert(1, "")

    with open(filepath, "w") as f:
        f.write("\n".join(lines))
    patched += 1
    rel = filepath.replace(BASE + "/", "")
    print(f"  patched: {rel}")

print(f"\nDone. Patched {patched}, skipped {skipped} (already had directive).")
