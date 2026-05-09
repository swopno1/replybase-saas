"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Loader2, 
  ShieldCheck, 
  ShieldOff, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  MoreHorizontal
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const dynamic = 'force-dynamic';

interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  isAdmin: boolean;
  role: "USER" | "ADMIN" | "SUPERADMIN";
  createdAt: string;
  tenant: { id: string; name: string } | null;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  
  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      
      if (search) params.append("search", search);
      if (roleFilter !== "ALL") params.append("role", roleFilter);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();
      
      if (res.ok) {
        setUsers(data.users);
        setPagination(data.pagination);
      } else {
        toast.error(data.error || "Failed to load users", {
          description: data.code ? `Error Code: ${data.code}` : undefined
        });
      }
    } catch (error: any) {
      toast.error("Failed to load users", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, roleFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300); // Debounce search
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleUpdateRole = async (userId: string, newRole: string) => {
    setActionUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();
      
      if (res.ok) {
        toast.success(`User role updated to ${newRole}`);
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, role: data.user.role, isAdmin: data.user.isAdmin } : u,
          ),
        );
      } else {
        toast.error(data.error || "Failed to update user", {
          description: data.code ? `Error Code: ${data.code}` : undefined
        });
      }
    } catch (error: any) {
      toast.error("Failed to update user", {
        description: error.message
      });
    } finally {
      setActionUserId(null);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "SUPERADMIN":
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200">Super Admin</Badge>;
      case "ADMIN":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">Admin</Badge>;
      default:
        return <Badge variant="secondary">User</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
          <p className="text-muted-foreground">
            Manage roles and permissions across all platform users.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                className="pl-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1); // Reset to first page on search
                }}
              />
            </div>
            <div className="w-full md:w-[200px]">
              <Select 
                value={roleFilter} 
                onValueChange={(val) => {
                  setRoleFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Roles</SelectItem>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="SUPERADMIN">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Platform Users</CardTitle>
            <CardDescription>
              {pagination ? `Total ${pagination.total} users found` : "Loading users..."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                // SKELETON ROWS
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[80px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[100px]" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-full" /></TableCell>
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const isSelf = user.id === session?.user?.id;
                  const isActioning = actionUserId === user.id;

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {user.name || "—"}
                            {isSelf && <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0 h-4">YOU</Badge>}
                          </span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">
                          {user.tenant ? (
                            <Link 
                              href={`/admin/tenants/${user.tenant.id}`}
                              className="text-primary hover:underline"
                            >
                              {user.tenant.name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground italic">No Workspace</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(user.role)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={isSelf || isActioning}>
                              <span className="sr-only">Open menu</span>
                              {isActioning ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleUpdateRole(user.id, "USER")} disabled={user.role === "USER"}>
                              <ShieldOff className="mr-2 h-4 w-4" />
                              Set as User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateRole(user.id, "ADMIN")} disabled={user.role === "ADMIN"}>
                              <ShieldCheck className="mr-2 h-4 w-4 text-blue-600" />
                              Set as Admin
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateRole(user.id, "SUPERADMIN")} disabled={user.role === "SUPERADMIN"}>
                              <ShieldCheck className="mr-2 h-4 w-4 text-purple-600" />
                              Set as Super Admin
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between space-x-2 py-4">
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
