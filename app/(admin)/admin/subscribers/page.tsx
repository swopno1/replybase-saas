"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, 
  Search, 
  Trash2, 
  Calendar, 
  Eye, 
  ChevronLeft, 
  ChevronRight,
  Filter
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useConfirmation } from "@/components/ui/confirmation-provider";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

interface Subscriber {
  id: string;
  tenantId: string;
  status: string;
  stripeId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
  plan: {
    id: string;
    name: string;
    price: number;
  };
  tenant: {
    id: string;
    name: string;
    users: Array<{
      id: string;
      email: string | null;
      name: string | null;
    }>;
  };
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function SubscribersPage() {
  const { confirm } = useConfirmation();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const fetchSubscribers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const response = await fetch(`/api/admin/subscribers?${params.toString()}`);
      const data = await response.json();
      
      if (response.ok) {
        setSubscribers(data.subscribers);
        setPagination(data.pagination);
      } else {
        toast.error(data.error || "Failed to fetch subscribers", {
          description: data.code ? `Error Code: ${data.code}` : undefined
        });
      }
    } catch (error: any) {
      console.error("Error fetching subscribers:", error);
      toast.error("Error loading subscribers", { description: error.message });
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchTerm, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSubscribers();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchSubscribers]);

  const handleDelete = async (subscriberId: string) => {
    const confirmed = await confirm({
      title: "Delete Subscription",
      description: "Are you sure you want to delete this subscription? This action cannot be undone.",
      confirmText: "Delete",
      variant: "destructive",
    });

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/subscribers/${subscriberId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Subscription deleted successfully");
        fetchSubscribers();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete subscription");
      }
    } catch (error: any) {
      console.error("Error deleting subscription:", error);
      toast.error("Error deleting subscription", { description: error.message });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200 hover:bg-green-100";
      case "trialing":
        return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100";
      case "canceled":
        return "bg-red-100 text-red-800 border-red-200 hover:bg-red-100";
      case "incomplete":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-100";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Subscriber Management</h2>
        <p className="text-muted-foreground">
          View and manage active paid subscriptions and billing status.
        </p>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search workspace, name or email..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-full md:w-[200px]">
              <Select value={statusFilter} onValueChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All (Paid & Free)</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="free">Free Users</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Paid Subscriptions</CardTitle>
          <CardDescription>
            {pagination ? `Total ${pagination.total} paid subscriptions managed` : "Loading subscriptions..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Primary User</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Current Period</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-6 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[80px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[120px]" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-[80px] ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : subscribers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No subscriptions found.
                  </TableCell>
                </TableRow>
              ) : (
                subscribers.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">
                      {sub.tenant.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{sub.tenant.users[0]?.name || "—"}</span>
                        <span className="text-xs text-muted-foreground">{sub.tenant.users[0]?.email || "No email"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium capitalize">{sub.plan.name}</span>
                        <span className="text-xs text-muted-foreground">£{sub.plan.price}/mo</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${getStatusColor(sub.status)} border-transparent font-semibold`}>
                        {sub.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {sub.currentPeriodEnd ? (
                        <div className="text-xs">
                          <div className="flex items-center gap-1 font-medium">
                            <Calendar className="h-3 w-3" />
                            {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                          </div>
                          {sub.cancelAtPeriodEnd && (
                            <span className="text-red-500 font-semibold">
                              Cancels at end
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild title="View Details">
                          <Link href={`/admin/subscribers/${sub.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(sub.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          title="Delete Subscription"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between space-x-2 py-4 border-t mt-4">
              <div className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages || loading}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
