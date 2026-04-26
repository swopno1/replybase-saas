"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Download,
  Loader2,
  Mail,
  MoreHorizontal,
  Phone,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirmation } from "@/components/ui/confirmation-provider";

export const dynamic = "force-dynamic";

interface Lead {
  id: string;
  name: string | null;
  company: string | null;
  mobile: string | null;
  email: string | null;
  businessType: string | null;
  source: string;
  status: string;
  interestedInSubscription: boolean;
  selectedPlan: string | null;
  trialRequested: boolean;
  tags: unknown;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  contact: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

interface ColumnDef {
  key: string;
  label: string;
}

// Keys that are shown as dedicated DB columns and should not be repeated in
// the dynamic flowInputs section of the table.
const DEDICATED_KEYS = new Set([
  "name",
  "lead_name",
  "email",
  "lead_email",
  "phone",
  "mobile",
  "lead_phone",
  "company",
  "lead_company",
  "businessType",
  "business_type",
  "lead_need",
  "need",
  "budget",
  "lead_budget",
]);

const FIXED_EXPORT_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "businessType", label: "Business Type" },
  { key: "budget", label: "Budget" },
  { key: "enquiry", label: "Enquiry" },
  { key: "interestedInSubscription", label: "Interested in Subscription" },
  { key: "selectedPlan", label: "Selected Plan" },
  { key: "trialRequested", label: "Trial Requested" },
  { key: "tags", label: "Tags" },
  { key: "status", label: "Status" },
  { key: "source", label: "Source" },
  { key: "createdAt", label: "Captured At" },
];

function prettifyKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function readEnquiry(metadata: Lead["metadata"]): string | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  const enquiry = metadata.enquiry;
  return typeof enquiry === "string" && enquiry.trim() ? enquiry : null;
}

function formatLeadSource(source: string): string {
  switch (source) {
    case "website":
      return "Website";
    case "webchat":
      return "Webchat";
    case "form":
      return "Lead Form";
    default:
      return source.charAt(0).toUpperCase() + source.slice(1);
  }
}

function getLeadEmail(lead: Lead): string | null {
  return lead.email || lead.contact?.email || null;
}

function getLeadPhone(lead: Lead): string | null {
  return lead.mobile || lead.contact?.phone || null;
}

function getFlowInputs(lead: Lead): Record<string, string> {
  const fi = lead.metadata?.flowInputs;
  if (!fi || typeof fi !== "object" || Array.isArray(fi)) return {};
  return fi as Record<string, string>;
}

function getLeadCsvValue(lead: Lead, key: string): string {
  switch (key) {
    case "name":
      return lead.name || lead.contact?.name || "";
    case "email":
      return getLeadEmail(lead) || "";
    case "phone":
      return getLeadPhone(lead) || "";
    case "company":
      return lead.company || "";
    case "businessType":
      return lead.businessType || "";
    case "budget":
      return (lead.metadata?.budget as string) || "";
    case "enquiry":
      return readEnquiry(lead.metadata) || "";
    case "interestedInSubscription":
      return lead.interestedInSubscription ? "Yes" : "No";
    case "selectedPlan":
      return lead.selectedPlan || "";
    case "trialRequested":
      return lead.trialRequested ? "Yes" : "No";
    case "tags":
      return Array.isArray(lead.tags) ? lead.tags.join(", ") : "";
    case "status":
      return lead.status || "";
    case "source":
      return formatLeadSource(lead.source);
    case "createdAt":
      return new Date(lead.createdAt).toLocaleString();
    default:
      return getFlowInputs(lead)[key] || "";
  }
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default function LeadsPage() {
  const { confirm } = useConfirmation();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [canExport, setCanExport] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const response = await fetch("/api/leads");
        if (response.ok) {
          const data = await response.json();
          setLeads(data.leads);
          setCanExport(data.canExport ?? false);
        }
      } catch (error) {
        console.error("Failed to fetch leads:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, []);

  // Dynamic columns derived from metadata.flowInputs across all leads,
  // excluding keys already shown as dedicated table columns.
  const dynamicColumns = useMemo<ColumnDef[]>(() => {
    const keys = new Set<string>();
    for (const lead of leads) {
      for (const key of Object.keys(getFlowInputs(lead))) {
        if (!DEDICATED_KEYS.has(key)) {
          keys.add(key);
        }
      }
    }
    return [...keys].map((key) => ({ key, label: prettifyKey(key) }));
  }, [leads]);

  // All available export columns: fixed + dynamic flow inputs
  const allExportColumns = useMemo<ColumnDef[]>(() => {
    const dynamicExport = dynamicColumns.filter(
      (c) => !FIXED_EXPORT_COLUMNS.some((f) => f.key === c.key),
    );
    return [...FIXED_EXPORT_COLUMNS, ...dynamicExport];
  }, [dynamicColumns]);

  // Pre-select all columns when the dialog first opens
  const openExportDialog = () => {
    setSelectedColumns(new Set(allExportColumns.map((c) => c.key)));
    setExportDialogOpen(true);
  };

  const toggleColumn = (key: string) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleExport = () => {
    const cols = allExportColumns.filter((c) => selectedColumns.has(c.key));
    if (!cols.length) {
      toast.error("Select at least one column to export.");
      return;
    }

    const header = cols.map((c) => escapeCsv(c.label)).join(",");
    const rows = leads.map((lead) =>
      cols.map((c) => escapeCsv(getLeadCsvValue(lead, c.key))).join(","),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportDialogOpen(false);
    toast.success("CSV downloaded");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-blue-500";
      case "contacted":
        return "bg-yellow-500";
      case "qualified":
        return "bg-emerald-500";
      case "converted":
        return "bg-purple-500";
      case "lost":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getPlanBadge = (plan: string | null, trial: boolean) => {
    if (!plan) return null;
    const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
    return (
      <Badge variant="outline">
        {planName} {trial && "(Trial)"}
      </Badge>
    );
  };

  const handleDeleteLead = async (leadId: string) => {
    const confirmed = await confirm({
      title: "Delete Lead",
      description: "Delete this lead? This action cannot be undone.",
      confirmText: "Delete",
      variant: "destructive",
    });

    if (!confirmed) {
      return;
    }

    setDeletingLeadId(leadId);
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "Failed to delete lead");
      }

      setLeads((prev) => prev.filter((lead) => lead.id !== leadId));
      toast.success("Lead deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete lead",
      );
    } finally {
      setDeletingLeadId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Leads</h1>
        <p className="text-muted-foreground mt-2">
          Review website enquiries captured through your chat widget and lead
          forms
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>All Leads</CardTitle>
            <CardDescription>
              View the latest captured leads with contact details, enquiry
              content, and capture time
            </CardDescription>
          </div>
          {canExport && leads.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={openExportDialog}
              className="shrink-0"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : leads.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No leads yet. New website enquiries will appear here after a
              visitor submits your chat widget or lead capture form.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Business Type</TableHead>
                    <TableHead>Enquiry</TableHead>
                    {dynamicColumns.map((col) => (
                      <TableHead key={col.key}>{col.label}</TableHead>
                    ))}
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Captured At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => {
                    const flowInputs = getFlowInputs(lead);
                    return (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {lead.name || lead.contact?.name || "—"}
                        </TableCell>
                        <TableCell>
                          {getLeadEmail(lead) ? (
                            <a
                              href={`mailto:${getLeadEmail(lead)}`}
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline whitespace-nowrap"
                            >
                              <Mail className="h-3.5 w-3.5 shrink-0" />
                              {getLeadEmail(lead)}
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {getLeadPhone(lead) ? (
                            <a
                              href={`tel:${getLeadPhone(lead)}`}
                              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline whitespace-nowrap"
                            >
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              {getLeadPhone(lead)}
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {lead.company || "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {lead.businessType || "—"}
                        </TableCell>
                        <TableCell className="max-w-xs whitespace-pre-wrap text-sm text-muted-foreground">
                          {readEnquiry(lead.metadata) || "—"}
                        </TableCell>
                        {dynamicColumns.map((col) => (
                          <TableCell
                            key={col.key}
                            className="max-w-xs whitespace-pre-wrap text-sm"
                          >
                            {flowInputs[col.key] || "—"}
                          </TableCell>
                        ))}
                        <TableCell>
                          {lead.interestedInSubscription ? (
                            getPlanBadge(
                              lead.selectedPlan,
                              lead.trialRequested,
                            )
                          ) : (
                            <Badge variant="outline" className="bg-gray-100">
                              Not Interested
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${getStatusColor(lead.status)} text-white`}
                          >
                            {lead.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatLeadSource(lead.source)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(lead.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Lead options"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {getLeadEmail(lead) ? (
                                <DropdownMenuItem asChild>
                                  <a href={`mailto:${getLeadEmail(lead)}`}>
                                    <Mail className="mr-2 h-4 w-4" />
                                    Email lead
                                  </a>
                                </DropdownMenuItem>
                              ) : null}
                              {getLeadPhone(lead) ? (
                                <DropdownMenuItem asChild>
                                  <a href={`tel:${getLeadPhone(lead)}`}>
                                    <Phone className="mr-2 h-4 w-4" />
                                    Call lead
                                  </a>
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem
                                onClick={() => handleDeleteLead(lead.id)}
                                disabled={deletingLeadId === lead.id}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {deletingLeadId === lead.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Export CSV dialog ─────────────────────────────────────────── */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export Leads as CSV</DialogTitle>
            <DialogDescription>
              Choose which columns to include. All columns are selected by
              default.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-3 py-2 pr-1">
            {allExportColumns.map((col) => (
              <div key={col.key} className="flex items-center gap-3">
                <Checkbox
                  id={`col-${col.key}`}
                  checked={selectedColumns.has(col.key)}
                  onCheckedChange={() => toggleColumn(col.key)}
                />
                <Label
                  htmlFor={`col-${col.key}`}
                  className="cursor-pointer font-normal"
                >
                  {col.label}
                </Label>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setExportDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Download CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Lead Pipeline Summary ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { status: "new", label: "New Leads", color: "bg-blue-500" },
          {
            status: "contacted",
            label: "Contacted",
            color: "bg-yellow-500",
          },
          {
            status: "qualified",
            label: "Qualified",
            color: "bg-emerald-500",
          },
          {
            status: "converted",
            label: "Converted",
            color: "bg-purple-500",
          },
          { status: "lost", label: "Lost", color: "bg-red-500" },
        ].map((item) => (
          <Card
            key={item.status}
            className={`border-t-4 ${
              item.status === "new"
                ? "border-blue-500"
                : item.status === "contacted"
                  ? "border-yellow-500"
                  : item.status === "qualified"
                    ? "border-emerald-500"
                    : item.status === "converted"
                      ? "border-purple-500"
                      : "border-red-500"
            }`}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {leads.filter((l) => l.status === item.status).length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {leads.length > 0
                  ? Math.round(
                      (leads.filter((l) => l.status === item.status).length /
                        leads.length) *
                        100,
                    )
                  : 0}
                % of total
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Lead statistics ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Interest & Activation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">{leads.length}</div>
              <div className="text-sm text-muted-foreground">Total Records</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">
                {leads.filter((l) => l.interestedInSubscription).length}
              </div>
              <div className="text-sm text-muted-foreground">
                Subscription Interest
              </div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">
                {leads.filter((l) => l.trialRequested).length}
              </div>
              <div className="text-sm text-muted-foreground">
                Trial Requests
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
