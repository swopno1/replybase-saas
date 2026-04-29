"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Download,
  Mail,
  MoreHorizontal,
  Phone,
  Trash2,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirmation } from "@/components/ui/confirmation-provider";
import { DataTable } from "@/components/data-table";
import { ColumnDef, PaginationState, RowSelectionState } from "@tanstack/react-table";

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

function getPlanBadge(plan: string | null, trial: boolean) {
  if (!plan) return <Badge variant="outline">None</Badge>;
  const label = plan.charAt(0).toUpperCase() + plan.slice(1);
  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary">{label}</Badge>
      {trial && <Badge variant="outline" className="text-[10px] h-4 px-1">Trial</Badge>}
    </div>
  );
}

export default function LeadsPage() {
  const { confirm } = useConfirmation();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isAllMatchingSelected, setIsAllMatchingSelected] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: (pagination.pageIndex + 1).toString(),
        limit: pagination.pageSize.toString(),
      });
      const response = await fetch(`/api/leads?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setLeads(data.leads);
        setTotalCount(data.totalCount);
        setPageCount(data.totalPages);
        setIsAllMatchingSelected(false);
      }
    } catch (error) {
      console.error("Failed to fetch leads:", error);
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [pagination]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const dynamicColumns = useMemo(() => {
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

  const handleDeleteLeads = async (ids: string[], allMatching = false) => {
    const message = allMatching
      ? `Are you sure you want to delete ALL ${totalCount} matching leads? This action cannot be undone.`
      : `Are you sure you want to delete ${ids.length} lead(s)? This action cannot be undone.`;

    const confirmed = await confirm({
      title: "Delete Leads",
      description: message,
      confirmText: "Delete",
      variant: "destructive",
    });

    if (!confirmed) return;

    try {
      const response = await fetch("/api/leads", {
        method: "DELETE",
        body: JSON.stringify({ ids: allMatching ? "ALL" : ids }),
      });

      if (!response.ok) throw new Error("Failed to delete leads");

      toast.success(`${allMatching ? totalCount : ids.length} lead(s) deleted`);
      setRowSelection({});
      fetchLeads();
    } catch (error) {
      toast.error("Failed to delete leads");
    }
  };

  const handleExport = async (ids?: string[]) => {
    setIsExporting(true);
    try {
      let leadsToExport: Lead[] = [];
      if (ids && ids.length > 0) {
        leadsToExport = leads.filter(l => ids.includes(l.id));
      } else {
        const response = await fetch(`/api/leads?limit=1000`);
        if (response.ok) {
          const data = await response.json();
          leadsToExport = data.leads;
        }
      }

      if (leadsToExport.length === 0) {
        toast.error("No leads to export");
        return;
      }

      const escapeCsv = (value: string): string => {
        if (/[",\n\r]/.test(value)) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      const headers = ["Name", "Email", "Phone", "Company", "Business Type", "Status", "Source", "Captured At"];
      const csvRows = leadsToExport.map(l => [
        l.name || l.contact?.name || "",
        getLeadEmail(l) || "",
        getLeadPhone(l) || "",
        l.company || "",
        l.businessType || "",
        l.status,
        formatLeadSource(l.source),
        new Date(l.createdAt).toLocaleString()
      ].map(v => escapeCsv(v)).join(","));

      const csv = [headers.join(","), ...csvRows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export leads");
    } finally {
      setIsExporting(false);
    }
  };

  const handleUpdateStatus = async (ids: string[], status: string, allMatching = false) => {
    try {
      const response = await fetch("/api/leads", {
        method: "PATCH",
        body: JSON.stringify({ ids: allMatching ? "ALL" : ids, status }),
      });

      if (!response.ok) throw new Error("Failed to update status");

      toast.success(`Status updated`);
      setRowSelection({});
      fetchLeads();
    } catch (error) {
      toast.error("Failed to update status");
    }
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

  const columns = useMemo<ColumnDef<Lead>[]>(() => {
    const cols: ColumnDef<Lead>[] = [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div className="font-medium whitespace-nowrap">
            {row.original.name || row.original.contact?.name || "—"}
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => {
          const email = getLeadEmail(row.original);
          return email ? (
            <a href={`mailto:${email}`} className="text-blue-600 hover:underline inline-flex items-center gap-1 whitespace-nowrap">
              <Mail className="h-3 w-3" />
              {email}
            </a>
          ) : "—";
        },
      },
      {
        accessorKey: "mobile",
        header: "Phone",
        cell: ({ row }) => {
          const phone = getLeadPhone(row.original);
          return phone ? (
            <a href={`tel:${phone}`} className="text-muted-foreground hover:underline inline-flex items-center gap-1 whitespace-nowrap">
              <Phone className="h-3 w-3" />
              {phone}
            </a>
          ) : "—";
        },
      },
      { accessorKey: "company", header: "Company", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.company || "—"}</span> },
      { accessorKey: "businessType", header: "Business Type", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.businessType || "—"}</span> },
      {
        id: "enquiry",
        header: "Enquiry",
        cell: ({ row }) => (
          <div className="max-w-[200px] truncate" title={readEnquiry(row.original.metadata) || ""}>
            {readEnquiry(row.original.metadata) || "—"}
          </div>
        ),
      },
      ...dynamicColumns.map((dcol) => ({
        id: dcol.key,
        header: dcol.label,
        cell: ({ row }: { row: any }) => <span className="max-w-xs truncate block">{getFlowInputs(row.original)[dcol.key] || "—"}</span>,
      })),
      {
        id: "plan",
        header: "Plan",
        cell: ({ row }) => row.original.interestedInSubscription ? (
          getPlanBadge(row.original.selectedPlan, row.original.trialRequested)
        ) : (
          <Badge variant="outline" className="bg-gray-100">Not Interested</Badge>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge className={`${getStatusColor(row.original.status)} text-white`}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => formatLeadSource(row.original.source),
      },
      {
        accessorKey: "createdAt",
        header: "Captured At",
        cell: ({ row }) => <span className="whitespace-nowrap">{new Date(row.original.createdAt).toLocaleString()}</span>,
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {getLeadEmail(row.original) && (
                  <DropdownMenuItem asChild>
                    <a href={`mailto:${getLeadEmail(row.original)}`}>
                      <Mail className="mr-2 h-4 w-4" />
                      Email lead
                    </a>
                  </DropdownMenuItem>
                )}
                {getLeadPhone(row.original) && (
                  <DropdownMenuItem asChild>
                    <a href={`tel:${getLeadPhone(row.original)}`}>
                      <Phone className="mr-2 h-4 w-4" />
                      Call lead
                    </a>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => handleDeleteLeads([row.original.id])} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ];
    return cols;
  }, [dynamicColumns, leads]);

  const selectedIds = useMemo(() => Object.keys(rowSelection), [rowSelection]);
  const currentSelectionCount = isAllMatchingSelected ? totalCount : selectedIds.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground mt-2">
            Review website enquiries captured through your chat widget and lead forms
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedIds.length > 0 && (
            <div className="flex gap-2 animate-in fade-in slide-in-from-top-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Update Status ({currentSelectionCount})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {["new", "contacted", "qualified", "converted", "lost"].map((s) => (
                    <DropdownMenuItem key={s} onClick={() => handleUpdateStatus(selectedIds, s, isAllMatchingSelected)}>
                      Mark as {s.charAt(0).toUpperCase() + s.slice(1)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={() => handleExport(isAllMatchingSelected ? undefined : selectedIds)} disabled={isExporting}>
                <Download className="mr-2 h-4 w-4" />
                Export {isAllMatchingSelected ? "All" : "Selected"} ({currentSelectionCount})
              </Button>
              <Button variant="destructive" size="sm" onClick={() => handleDeleteLeads(selectedIds, isAllMatchingSelected)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete ({currentSelectionCount})
              </Button>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => handleExport()} disabled={isExporting || leads.length === 0}>
             {isExporting ? <span className="animate-spin mr-2">◌</span> : <Download className="mr-2 h-4 w-4" />}
             Export All
          </Button>
        </div>
      </div>

      {/* Pipeline Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { status: "new", label: "New", color: "bg-blue-500" },
          { status: "contacted", label: "Contacted", color: "bg-yellow-500" },
          { status: "qualified", label: "Qualified", color: "bg-emerald-500" },
          { status: "converted", label: "Converted", color: "bg-purple-500" },
          { status: "lost", label: "Lost", color: "bg-red-500" },
        ].map((item) => {
          const count = leads.filter((l) => l.status === item.status).length;
          const percentage = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
          return (
            <Card key={item.status} className="border-l-4" style={{ borderLeftColor: item.color.replace('bg-', '') }}>
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">{item.label}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{percentage}% of total</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Leads</CardTitle>
          <CardDescription>
            View and manage your leads with advanced filtering and batch actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={leads}
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={setPagination}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            isLoading={loading}
            persistenceKey="leads_table"
            totalCount={totalCount}
            onSelectAllMatching={setIsAllMatchingSelected}
            isAllMatchingSelected={isAllMatchingSelected}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Subscription Interest</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leads.filter((l) => l.interestedInSubscription).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Trial Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leads.filter((l) => l.trialRequested).length}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
