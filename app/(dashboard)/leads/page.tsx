"use client";

import { useEffect, useState } from "react";
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
import { Loader2 } from "lucide-react";

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
  createdAt: string;
  contact: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const response = await fetch("/api/leads");
        if (response.ok) {
          const data = await response.json();
          setLeads(data.leads);
        }
      } catch (error) {
        console.error("Failed to fetch leads:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-blue-500";
      case "contacted":
        return "bg-yellow-500";
      case "qualified":
        return "bg-green-500";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Leads</h1>
        <p className="text-muted-foreground mt-2">
          Manage leads generated through your Facebook conversations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Leads</CardTitle>
          <CardDescription>
            View and manage leads captured through the default bot flow
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : leads.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No leads yet. Leads will appear here when users interact with your
              Facebook page.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Business Type</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        {lead.name || lead.contact?.name || "—"}
                      </TableCell>
                      <TableCell>{lead.company || "—"}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {lead.email && <div>{lead.email}</div>}
                          {lead.mobile && (
                            <div className="text-muted-foreground">
                              {lead.mobile}
                            </div>
                          )}
                          {!lead.email && !lead.mobile && "—"}
                        </div>
                      </TableCell>
                      <TableCell>{lead.businessType || "—"}</TableCell>
                      <TableCell>
                        {lead.interestedInSubscription ? (
                          getPlanBadge(lead.selectedPlan, lead.trialRequested)
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
                      <TableCell className="capitalize">
                        {lead.source}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lead Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">{leads.length}</div>
              <div className="text-sm text-muted-foreground">Total Leads</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">
                {leads.filter((l) => l.status === "qualified").length}
              </div>
              <div className="text-sm text-muted-foreground">Qualified</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">
                {leads.filter((l) => l.interestedInSubscription).length}
              </div>
              <div className="text-sm text-muted-foreground">
                Interested in Subscription
              </div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">
                {leads.filter((l) => l.trialRequested).length}
              </div>
              <div className="text-sm text-muted-foreground">
                Trial Requested
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
