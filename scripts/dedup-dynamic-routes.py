#!/usr/bin/env python3
"""Remove duplicate 'export const dynamic' declarations from Next.js route files."""
import re, glob

DIRECTIVE = "export const dynamic = 'force-dynamic';"


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


fixed = 0
for filepath in sorted(glob.glob("app/api/**/route.ts", recursive=True)):
    with open(filepath) as f:
        content = f.read()

    # Normalise double-quote variant
    content = content.replace('export const dynamic = "force-dynamic";', DIRECTIVE)

    matches = list(re.finditer(re.escape(DIRECTIVE), content))
    if len(matches) <= 1:
        # Write back normalised form even if no dup
        with open(filepath, "w") as f:
            f.write(content)
        continue

    # Remove all occurrences then insert exactly one after last import
    content = content.replace(DIRECTIVE, "")
    content = re.sub(r"\n{3,}", "\n\n", content)
    lines = content.split("\n")
    idx = last_import_line(lines)
    if idx >= 0:
        lines.insert(idx + 1, "")
        lines.insert(idx + 2, DIRECTIVE)
    else:
        lines.insert(0, DIRECTIVE)
        lines.insert(1, "")
    content = "\n".join(lines)

    with open(filepath, "w") as f:
        f.write(content)
    fixed += 1
    print(f"  deduped: {filepath}")

print(f"\nDeduped {fixed} files.")
