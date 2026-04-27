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

export default function LeadsPage() {
  const { confirm } = useConfirmation();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [canExport, setCanExport] = useState(false);
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
        setCanExport(data.canExport ?? false);
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
      description: `Are you sure you want to delete ${ids.length} lead(s)? This action cannot be undone.`,
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

      toast.success(`${ids.length} lead(s) deleted`);
      setRowSelection({});
      fetchLeads();
    } catch (error) {
      toast.error("Failed to delete leads");
    }
  };

  const handleExport = async (ids?: string[]) => {
    setIsExporting(true);
    try {
      let leadsToExport = [];
      if (ids && ids.length > 0) {
        // Export only selected
        leadsToExport = leads.filter(l => ids.includes(l.id));
      } else {
        // Export all matching current filters (matching page 1 size 1000 for simplicity)
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

      toast.success(`Status updated for ${ids.length} lead(s)`);
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
        cell: ({ row }) => row.original.name || row.original.contact?.name || "—",
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => {
          const email = getLeadEmail(row.original);
          return email ? (
            <a href={`mailto:${email}`} className="text-blue-600 hover:underline inline-flex items-center gap-1">
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
            <a href={`tel:${phone}`} className="text-muted-foreground hover:underline inline-flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {phone}
            </a>
          ) : "—";
        },
      },
      { accessorKey: "company", header: "Company", cell: ({ row }) => row.original.company || "—" },
      { accessorKey: "businessType", header: "Business Type", cell: ({ row }) => row.original.businessType || "—" },
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
        cell: ({ row }: { row: any }) => getFlowInputs(row.original)[dcol.key] || "—",
      })),
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
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground mt-2">
            Review website enquiries captured through your chat widget and lead forms
          </p>
        </div>
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
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>All Leads</CardTitle>
            <CardDescription>
              View and manage your leads with advanced filtering and batch actions.
            </CardDescription>
          </div>
          {canExport && leads.length > 0 && (
             <Button
               variant="outline"
               size="sm"
               onClick={() => handleExport()}
               disabled={isExporting}
             >
               {isExporting ? <span className="animate-spin mr-2">◌</span> : <Download className="mr-2 h-4 w-4" />}
               Export All
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
          
          {/* ── Delete this section ───────────────────────────────────────────── */}
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
    </div>
  );
}
