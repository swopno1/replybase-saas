export interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  paidAt: string | null;
  dueDate: string;
  downloadUrl?: string;
}

export interface PaymentMethodInfo {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface BillingData {
  subscription: unknown; // We'll refine this if we have a Subscription type
  usage: unknown; // From getTenantUsage
  invoices: Invoice[];
  paymentMethod: PaymentMethodInfo | null;
}
