export async function buildContext({
  user,
  tenant,
  filePath,
}: {
  user: { id: string; role: string };
  tenant: { id: string; plan: string };
  filePath?: string;
}) {
  return `
User role: ${user.role}
Tenant plan: ${tenant.plan}
Current file: ${filePath}

Rules reminder:
- Tenant scoped data only
- Stripe backend only
`;
}
