import { getServerSession } from "next-auth";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function OnboardingSessionsPage() {
  const session = await getServerSession(authOptions);

  // Restrict access to specific admin email
  if (
    !session?.user?.email ||
    session.user.email !== "amirhossain.limon@gmail.com"
  ) {
    redirect("/");
  }

  // Fetch all onboarding sessions
  const sessions = await prisma.onboardingSession.findMany({
    include: {
      contact: true,
      facebookPage: true,
      plan: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  // Calculate metrics
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(
    (s) => s.status === "COMPLETED",
  ).length;
  const inProgressSessions = sessions.filter(
    (s) => s.status === "IN_PROGRESS",
  ).length;
  const abandonedSessions = sessions.filter(
    (s) => s.status === "ABANDONED",
  ).length;

  const completionRate = totalSessions
    ? ((completedSessions / totalSessions) * 100).toFixed(1)
    : "0";

  // Calculate stage distribution
  const stageDistribution: Record<string, number> = {};
  sessions.forEach((s) => {
    stageDistribution[s.stage] = (stageDistribution[s.stage] || 0) + 1;
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Onboarding Sessions</h1>
        <p className="text-muted-foreground">
          Track and analyze client onboarding progress
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Total Sessions
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
            <CardTitle className="text-sm font-medium">Abandoned</CardTitle>
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

      {/* Stage Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Stage Distribution</CardTitle>
          <CardDescription>
            Where users are in the onboarding flow
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(stageDistribution).map(([stage, count]) => (
              <div key={stage} className="text-center">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs text-muted-foreground">{stage}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
          <CardDescription>Latest 100 onboarding sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    No onboarding sessions yet
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">
                      {session.contactName || session.contact.name || "Unknown"}
                    </TableCell>
                    <TableCell>
                      {session.businessName || "-"}
                      {session.businessType && (
                        <Badge variant="outline" className="ml-2">
                          {session.businessType}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{session.stage}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          session.status === "COMPLETED"
                            ? "default"
                            : session.status === "IN_PROGRESS"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {session.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{session.plan?.displayName || "-"}</TableCell>
                    <TableCell>
                      {new Date(session.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {session.email || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
