#!/usr/bin/env python3
"""Fix missing/misplaced 'export const dynamic = force-dynamic' in all API routes."""
import re, glob

DYNAMIC_EXPORT = "export const dynamic = 'force-dynamic';"

def fix_route_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Remove any misplaced dynamic export lines inserted mid-import by previous run
    content = re.sub(r'\nexport const dynamic = \'force-dynamic\';\n', '\n', content)
    content = re.sub(r'^export const dynamic = \'force-dynamic\';\n', '', content)

    # If a clean dynamic export already exists, nothing to do
    if DYNAMIC_EXPORT in content:
        with open(filepath, 'w') as f:
            f.write(content)
        return "already-correct"

    lines = content.split('\n')

    # Find the index of the last line that closes an import statement
    # Handle single-line and multi-line imports by tracking brace depth
    last_import_end = -1
    in_import = False
    brace_depth = 0

    for i, line in enumerate(lines):
        stripped = line.strip()

        if not in_import and stripped.startswith('import '):
            in_import = True
            brace_depth += stripped.count('{') - stripped.count('}')
            if brace_depth <= 0 and stripped.endswith(';'):
                last_import_end = i
                in_import = False
                brace_depth = 0
        elif in_import:
            brace_depth += stripped.count('{') - stripped.count('}')
            if brace_depth <= 0 and stripped.endswith(';'):
                last_import_end = i
                in_import = False
                brace_depth = 0

    if last_import_end >= 0:
        lines.insert(last_import_end + 1, '')
        lines.insert(last_import_end + 2, DYNAMIC_EXPORT)
    else:
        lines.insert(0, DYNAMIC_EXPORT)
        lines.insert(1, '')

    with open(filepath, 'w') as f:
        f.write('\n'.join(lines))
    return "patched"


routes = glob.glob('app/api/**/route.ts', recursive=True)
counts = {}
for r in sorted(routes):
    status = fix_route_file(r)
    counts[status] = counts.get(status, 0) + 1
    print(f"  {status}: {r}")

print(f"\nDone. {len(routes)} routes total.")
for k, v in counts.items():
    print(f"  {k}: {v}")
