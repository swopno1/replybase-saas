import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  DollarSign,
  TrendingUp,
  MessageSquare,
  Bot,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { PlausibleDashboard } from "@/components/admin/plausible-dashboard";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

async function getBusinessStats() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalUsers,
    totalTenants,
    activeSubscriptions,
    totalBots,
    totalContacts,
    totalConversations,
    recentSubscriptions,
    revenueData,
    onboardingStats,
    revenueDetails,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.tenant.count(),
    prisma.subscription.count({
      where: { status: { in: ["active", "trialing"] } },
    }),
    prisma.bot.count(),
    prisma.contact.count(),
    prisma.crmConversation.count(),
    prisma.subscription.findMany({
      where: { status: { in: ["active", "trialing"] } },
      include: {
        plan: true,
        tenant: {
          include: { users: { select: { email: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.revenue.aggregate({
      _sum: { amount: true },
      where: {
        status: "paid",
        paidAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.tenant.aggregate({
      _count: { id: true },
      where: { isOnboarded: true },
    }),
    prisma.tenant.findMany({
      include: {
        subscriptions: {
          include: { plan: true },
        },
        users: {
          select: { email: true, name: true },
          take: 1,
        },
        revenue: {
          orderBy: { paidAt: "desc" },
        },
      },
      where: {
        subscriptions: { isNot: null },
      },
    }),
  ]);

  const totalOnboarding = await prisma.tenant.count({
    where: {
      OR: [
        { isOnboarded: true },
        { onboardingStep: { gt: 0 } },
      ],
    },
  });

  const formattedRevenueDetails = revenueDetails.map((tenant) => {
    const totalPaid = tenant.revenue.reduce((sum, rev) => sum + rev.amount, 0);
    const lastPayment = tenant.revenue[0];

    return {
      tenantName: tenant.name,
      userEmail: tenant.users[0]?.email || "N/A",
      stripeSubscriptionId: tenant.subscriptions?.stripeId || "N/A",
      monthlyAmount: tenant.subscriptions?.plan.price || 0,
      lastPaymentDate: lastPayment?.paidAt || null,
      status: tenant.subscriptions?.status || "inactive",
      totalPaid,
    };
  });

  return {
    totalUsers,
    totalTenants,
    activeSubscriptions,
    totalBots,
    totalContacts,
    totalConversations,
    recentSubscriptions,
    monthlyRevenue: revenueData._sum.amount || 0,
    onboardingConversion: totalOnboarding
      ? ((onboardingStats._count.id / totalOnboarding) * 100).toFixed(1)
      : "0",
    totalOnboarding,
    revenueDetails: formattedRevenueDetails,
  };
}

export default async function AdminPage() {
  const stats = await getBusinessStats();
  const plausibleSharedLink = process.env.PLAUSIBLE_SHARED_LINK;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
          Business Overview
        </h2>
        <p className="text-gray-500 mt-1">
          Key metrics and real-time performance overview.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Actual Revenue (30d)
            </CardTitle>
            <div className="p-2 bg-green-50 rounded-lg">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              £{stats.monthlyRevenue.toFixed(2)}
            </div>
            <div className="flex items-center mt-2 text-xs font-medium text-green-600">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              <span>Real payments</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Active Subs
            </CardTitle>
            <div className="p-2 bg-blue-50 rounded-lg">
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {stats.activeSubscriptions}
            </div>
            <div className="flex items-center mt-2 text-xs font-medium text-gray-500">
              <span>{stats.totalTenants} total tenants</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Users
            </CardTitle>
            <div className="p-2 bg-purple-50 rounded-lg">
              <Users className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {stats.totalUsers}
            </div>
            <div className="flex items-center mt-2 text-xs font-medium text-purple-600">
              <span>Growing</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Conversion
            </CardTitle>
            <div className="p-2 bg-orange-50 rounded-lg">
              <Activity className="h-4 w-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {stats.onboardingConversion}%
            </div>
            <div className="flex items-center mt-2 text-xs font-medium text-orange-600">
              <span>{stats.totalOnboarding} sessions</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <PlausibleDashboard sharedLink={plausibleSharedLink} />

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Revenue Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                    <tr>
                      <th className="px-4 py-2">Tenant / User</th>
                      <th className="px-4 py-2">Stripe ID</th>
                      <th className="px-4 py-2 text-right">Monthly</th>
                      <th className="px-4 py-2">Last Paid</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2 text-right">Total Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.revenueDetails.map((detail, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{detail.tenantName}</div>
                          <div className="text-xs text-gray-500">{detail.userEmail}</div>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono">{detail.stripeSubscriptionId}</td>
                        <td className="px-4 py-3 text-right">£{detail.monthlyAmount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-xs">
                          {detail.lastPaymentDate ? new Date(detail.lastPaymentDate).toLocaleDateString() : "Never"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {detail.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-bold">£{detail.totalPaid.toFixed(2)}</td>
                      </tr>
                    ))}
                    {stats.revenueDetails.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-4 text-gray-500">No revenue data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>System Health & Activity</CardTitle>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Operational
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Bot size={16} />
                    <span className="text-xs font-medium uppercase">Bots</span>
                  </div>
                  <div className="text-xl font-bold">{stats.totalBots}</div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Users size={16} />
                    <span className="text-xs font-medium uppercase">Contacts</span>
                  </div>
                  <div className="text-xl font-bold">{stats.totalContacts}</div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <MessageSquare size={16} />
                    <span className="text-xs font-medium uppercase">Conversations</span>
                  </div>
                  <div className="text-xl font-bold">{stats.totalConversations}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Recent Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.recentSubscriptions.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">
                    No active subscriptions yet
                  </p>
                ) : (
                  stats.recentSubscriptions.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-blue-100 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {sub.tenant.users[0]?.name ||
                            sub.tenant.users[0]?.email ||
                            "Unknown"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {sub.tenant.users[0]?.email || "No email"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">
                          {sub.plan.name}
                        </Badge>
                        <p className="text-[10px] text-gray-400 mt-1 capitalize">
                          {sub.status}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-blue-600 text-white">
            <CardHeader>
              <CardTitle className="text-white">Admin Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="secondary" className="w-full justify-start text-blue-600" asChild>
                <a href="/admin/users">Manage All Users</a>
              </Button>
              <Button variant="secondary" className="w-full justify-start text-blue-600" asChild>
                <a href="/admin/subscribers">Review Billing</a>
              </Button>
              <Button variant="secondary" className="w-full justify-start text-blue-600" asChild>
                <a href="/admin/kpi-health">System Health</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
