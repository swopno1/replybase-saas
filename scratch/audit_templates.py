import re
import json

def audit_templates():
    with open("lib/flow-templates.ts", "r") as f:
        content = f.read()
    
    # We will just print the nodes and their nextNodeOrders for each template
    # using a simple regex or parser.
    # Actually, compiling TS to a JSON or just parsing the JS objects.
    pass

if __name__ == "__main__":
    audit_templates()
