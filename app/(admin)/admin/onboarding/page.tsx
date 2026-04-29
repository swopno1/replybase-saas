import { getServerSession } from "next-auth";
import { isPlatformAdmin } from "@/lib/admin";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Mail } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const STAGES = [
  "KYC",
  "Business Basics",
  "Product/Service",
  "Specifics",
  "Support & Sales",
  "Additional Context",
];

export default async function OnboardingSessionsPage({
  searchParams,
}: {
  searchParams?: { filter?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!isPlatformAdmin(session)) {
    redirect("/");
  }

  // Fetch all tenants to analyze onboarding
  const tenants = await prisma.tenant.findMany({
    include: {
      users: { select: { email: true, name: true } },
      subscriptions: { include: { plan: true } },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 200, // Increased to allow better filtering
  });

  let filteredTenants = tenants;
  const filter = searchParams?.filter;
  if (filter === "completed") {
    filteredTenants = tenants.filter(t => t.isOnboarded);
  } else if (filter === "in_progress") {
    filteredTenants = tenants.filter(t => !t.isOnboarded && t.onboardingStep > 0);
  } else if (filter === "abandoned") {
    filteredTenants = tenants.filter(t => !t.isOnboarded && t.onboardingStep === 0);
  }

  // Calculate metrics based on ALL tenants
  const totalSessions = tenants.length;
  const completedSessions = tenants.filter((t) => t.isOnboarded).length;

  // In progress means not onboarded, but step > 0
  const inProgressSessions = tenants.filter(
    (t) => !t.isOnboarded && t.onboardingStep > 0
  ).length;

  // Abandoned: not onboarded, step == 0 or unchanged for long time, for simplicity we just say un-started / abandoned
  const abandonedSessions = tenants.filter(
    (t) => !t.isOnboarded && t.onboardingStep === 0
  ).length;

  const completionRate = totalSessions
    ? ((completedSessions / totalSessions) * 100).toFixed(1)
    : "0";

  // Calculate stage distribution and other metrics
  const stageDistribution: Record<string, number> = {};
  const abandonmentByStage: Record<string, number> = {};
  const industryDistribution: Record<string, number> = {};

  tenants.forEach((t) => {
    // Stage distribution based on step number
    const stageName = t.isOnboarded ? "COMPLETED" : STAGES[t.onboardingStep] || "Unknown";
    stageDistribution[stageName] = (stageDistribution[stageName] || 0) + 1;

    if (!t.isOnboarded && t.onboardingStep > 0) {
      const abandonStage = STAGES[t.onboardingStep] || "Unknown";
      abandonmentByStage[abandonStage] = (abandonmentByStage[abandonStage] || 0) + 1;
    }

    // Extract data if exists
    const data = t.onboardingData as any;
    if (data?.raw?.businessBasics?.industry) {
      const industry = data.raw.businessBasics.industry;
      industryDistribution[industry] = (industryDistribution[industry] || 0) + 1;
    }
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Onboarding Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track and analyze client onboarding progress
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/api/user/data-export?type=onboarding" target="_blank" rel="noopener noreferrer">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </a>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link href="?filter=all">All</Link>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link href="?filter=completed">Completed</Link>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link href="?filter=in_progress">In Progress</Link>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link href="?filter=abandoned">Abandoned</Link>
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Total Tenants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSessions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {completedSessions}
            </div>
            <p className="text-xs text-muted-foreground">
              {completionRate}% conversion
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {inProgressSessions}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Not Started</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {abandonedSessions}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalSessions
                ? ((abandonedSessions / totalSessions) * 100).toFixed(1)
                : "0"}
              % drop-off
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stage Analysis */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Current Stage</CardTitle>
            <CardDescription>
              Users currently at each stage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stageDistribution)
                .sort((a, b) => b[1] - a[1])
                .map(([stage, count]) => (
                  <div
                    key={stage}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm font-medium capitalize">
                      {stage}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-32 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{
                            width: `${(count / totalSessions) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-bold">{count}</span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Drop-off Analysis</CardTitle>
            <CardDescription>Sessions abandoned at each stage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(abandonmentByStage).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No abandonments recorded yet
                </p>
              ) : (
                Object.entries(abandonmentByStage)
                  .sort((a, b) => b[1] - a[1])
                  .map(([stage, count]) => (
                    <div
                      key={stage}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm font-medium capitalize">
                        {stage}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500"
                            style={{
                              width: `${(count / (inProgressSessions || 1)) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-bold">{count}</span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Industries</CardTitle>
            <CardDescription>Based on completed onboarding data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(industryDistribution).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No industry data yet
                </p>
              ) : (
                Object.entries(industryDistribution)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([industry, count]) => (
                    <div
                      key={industry}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm font-medium truncate pr-4">
                        {industry}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold">{count}</span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Tenants Onboarding</CardTitle>
          <CardDescription>Latest 100 tenants</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Company Profile</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground"
                  >
                    No onboarding sessions yet
                  </TableCell>
                </TableRow>
              ) : (
                filteredTenants.map((tenant) => {
                  const data = tenant.onboardingData as any;
                  const companyName = data?.raw?.kyc?.company || "-";
                  const companySize = data?.raw?.businessBasics?.companySize || "";
                  const industry = data?.raw?.businessBasics?.industry;
                  const aiSummary = data?.summary?.companyProfile || "";
                  const email = tenant.users[0]?.email || "-";

                  return (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">
                        {tenant.name}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">{companyName}</div>
                        {companySize && <div className="text-xs text-muted-foreground">{companySize}</div>}
                        {aiSummary && <div className="text-xs italic text-gray-500 mt-1 max-w-[200px] truncate" title={aiSummary}>{aiSummary}</div>}
                      </TableCell>
                      <TableCell>
                        {industry ? (
                          <Badge variant="outline">{industry}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {tenant.isOnboarded ? "COMPLETED" : STAGES[tenant.onboardingStep] || "Started"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            tenant.isOnboarded
                              ? "default"
                              : tenant.onboardingStep > 0
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {tenant.isOnboarded ? "COMPLETED" : tenant.onboardingStep > 0 ? "IN_PROGRESS" : "NOT_STARTED"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tenant.subscriptions && Array.isArray(tenant.subscriptions)
                          ? tenant.subscriptions[0]?.plan?.displayName || "-"
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {new Date(tenant.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {email}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`mailto:${email}?subject=Need help completing your setup?`}>
                            <Mail className="w-4 h-4" />
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
