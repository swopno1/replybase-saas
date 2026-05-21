import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update variables using regex
    # Replace {{lead_name}} or {{contact_name}} but avoid touching ones already having ||
    content = re.sub(r'\{\{\s*(?:lead_name|contact_name)\s*\}\}', '{{contact_name || lead_name}}', content)
    content = re.sub(r'\{\{\s*(?:lead_email|contact_email)\s*\}\}', '{{contact_email || lead_email}}', content)

    # 2. URL encode session_hash in URLs
    content = re.sub(r'SYNC_\{\{session_hash\}\}', 'SYNC_{{session_hash | urlencode}}', content)

    # 3. Re-index each template block
    # We find blocks starting with "export const ... = {" and ending where the next export starts, or end of file.
    # Actually, it's safer to split by "export const "
    parts = content.split('export const ')
    new_parts = [parts[0]]

    for part in parts[1:]:
        # Find all `order:` lines to gather the existing orders
        orders = []
        for match in re.finditer(r'\border:\s*(\d+)\s*,?', part):
            orders.append(int(match.group(1)))
        
        if not orders:
            new_parts.append(part)
            continue
            
        unique_orders = sorted(list(set(orders)))
        order_map = {old: new for new, old in enumerate(unique_orders)}

        # We must carefully replace `order: X` and `nextNodeOrder: X` 
        # Since we might replace 10 with 7, and then later try to replace 7 with something else,
        # we should do it in a single pass using a regex replacement function.
        def replacer(match):
            keyword = match.group(1) # "order" or "nextNodeOrder"
            num = int(match.group(2))
            if num in order_map:
                new_num = order_map[num]
                return f"{keyword}: {new_num}"
            return match.group(0)

        # Match exactly `order: <number>` or `nextNodeOrder: <number>` followed by comma or space/newline
        new_part = re.sub(r'\b(order|nextNodeOrder):\s*(\d+)', replacer, part)
        new_parts.append(new_part)

    final_content = "export const ".join(new_parts)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(final_content)

if __name__ == "__main__":
    process_file("lib/flow-templates.ts")
