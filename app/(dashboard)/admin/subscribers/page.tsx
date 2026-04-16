"use client";

import { useEffect, useState } from "react";
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
import { Loader2, Search, Pencil, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { EditSubscriberDialog } from "@/components/edit-subscriber-dialog";
import { useConfirmation } from "@/components/ui/confirmation-provider";

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

export default function SubscribersPage() {
  const { confirm } = useConfirmation();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [filteredSubscribers, setFilteredSubscribers] = useState<Subscriber[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(
    null,
  );

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const fetchSubscribers = async () => {
    try {
      const response = await fetch("/api/admin/subscribers");
      if (response.ok) {
        const data = await response.json();
        setSubscribers(data.subscribers);
      } else {
        toast.error("Failed to fetch subscribers");
      }
    } catch (error) {
      console.error("Error fetching subscribers:", error);
      toast.error("Error loading subscribers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    filterSubscribers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, statusFilter, subscribers]);

  const filterSubscribers = () => {
    let filtered = subscribers;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (sub) =>
          sub.tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          sub.tenant.users.some(
            (user) =>
              user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              user.name?.toLowerCase().includes(searchTerm.toLowerCase()),
          ),
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((sub) => sub.status === statusFilter);
    }

    setFilteredSubscribers(filtered);
  };

  const handleDelete = async (subscriberId: string) => {
    const confirmed = await confirm({
      title: "Delete Subscription",
      description: "Are you sure you want to delete this subscription?",
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
        toast.error("Failed to delete subscription");
      }
    } catch (error) {
      console.error("Error deleting subscription:", error);
      toast.error("Error deleting subscription");
    }
  };

  const handleEdit = (subscriber: Subscriber) => {
    setEditingSubscriber(subscriber);
  };

  const handleUpdateSuccess = () => {
    setEditingSubscriber(null);
    fetchSubscribers();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "trialing":
        return "bg-blue-500";
      case "canceled":
        return "bg-red-500";
      case "incomplete":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Subscriber Management</CardTitle>
          <CardDescription>
            View and manage all subscriber accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trialing">Trialing</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
                <SelectItem value="incomplete">Incomplete</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredSubscribers.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No subscribers found
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Current Period</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscribers.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">
                        {sub.tenant.name}
                      </TableCell>
                      <TableCell>
                        {sub.tenant.users[0]?.email || "No email"}
                      </TableCell>
                      <TableCell>{sub.plan.name}</TableCell>
                      <TableCell>${sub.plan.price}/mo</TableCell>
                      <TableCell>
                        <Badge
                          className={`${getStatusColor(sub.status)} text-white`}
                        >
                          {sub.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {sub.currentPeriodEnd ? (
                          <div className="text-sm">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(
                                sub.currentPeriodEnd,
                              ).toLocaleDateString()}
                            </div>
                            {sub.cancelAtPeriodEnd && (
                              <span className="text-xs text-red-500">
                                Cancels at period end
                              </span>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(sub)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(sub.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {editingSubscriber && (
        <EditSubscriberDialog
          subscriber={editingSubscriber}
          onClose={() => setEditingSubscriber(null)}
          onSuccess={handleUpdateSuccess}
        />
      )}
    </div>
  );
}
