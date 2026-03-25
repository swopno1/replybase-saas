import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default function BillingSettingsRedirect() {
  redirect("/settings?tab=billing");
}
