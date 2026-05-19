# Strategic Proposal: Granular IAM Roles & Permissions

## Business Need
As ReplyBase scales toward agency and enterprise customers, the current flat "User vs Admin" role structure is insufficient. Customers need the ability to invite team members with restricted access (e.g., "Support Staff" who can chat but not change bot settings, or "View Only" for analytics).

## Strategic Value
- **Enterprise Readiness**: Satisfies a core requirement for larger organizations.
- **Agency Enablement**: Allows agencies to invite clients to view their own bot's performance without access to billing or other client bots.
- **Security**: Minimizes the attack surface for a compromised user account.

## Proposed Roles
1. **Owner**: Full access, including billing and tenant deletion.
2. **Manager**: Manage bots, flows, and channels; cannot access billing.
3. **Agent**: Can view/reply to conversations and manage leads; cannot edit bots/flows.
4. **Analyst**: View only access to dashboard and metrics.

## UX Impact
- **Team Management Page**: A new settings section to invite and manage members.
- **Contextual UI**: Buttons and navigation items will be hidden or disabled based on the user's active permissions.
