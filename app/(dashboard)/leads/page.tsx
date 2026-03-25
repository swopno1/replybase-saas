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
import { Loader2, Mail, Phone } from "lucide-react";

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
  metadata?: Record<string, unknown> | null;
  contact: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
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
          Review website enquiries captured through your chat widget and lead
          forms
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Leads</CardTitle>
          <CardDescription>
            View the latest captured leads with contact details, enquiry
            content, and capture time
          </CardDescription>
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
                    <TableHead>Enquiry</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Captured At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        {lead.name || lead.contact?.name || "—"}
                      </TableCell>
                      <TableCell className="max-w-sm whitespace-pre-wrap text-sm text-muted-foreground">
                        {readEnquiry(lead.metadata) || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {getLeadEmail(lead) ? (
                            <div>
                              <a
                                href={`mailto:${getLeadEmail(lead)}`}
                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                <Mail className="h-3.5 w-3.5" />
                                <span>{getLeadEmail(lead)}</span>
                              </a>
                            </div>
                          ) : null}
                          {getLeadPhone(lead) ? (
                            <div className="mt-1">
                              <a
                                href={`tel:${getLeadPhone(lead)}`}
                                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
                              >
                                <Phone className="h-3.5 w-3.5" />
                                <span>{getLeadPhone(lead)}</span>
                              </a>
                            </div>
                          ) : null}
                          {!getLeadEmail(lead) && !getLeadPhone(lead)
                            ? "—"
                            : null}
                        </div>
                      </TableCell>
                      <TableCell>{lead.company || "—"}</TableCell>
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
                      <TableCell>{formatLeadSource(lead.source)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(lead.createdAt).toLocaleString()}
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
