import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default function BillingRedirect() {
  redirect("/settings/billing");
}
