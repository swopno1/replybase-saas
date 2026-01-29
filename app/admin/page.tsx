import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  DollarSign,
  TrendingUp,
  MessageSquare,
  Bot,
  Activity,
} from "lucide-react";

export const dynamic = "force-dynamic";

async function getBusinessStats() {
  const [
    totalUsers,
    totalTenants,
    activeSubscriptions,
    totalBots,
    totalContacts,
    totalConversations,
    recentSubscriptions,
    monthlyRevenue,
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
    prisma.subscription.findMany({
      where: {
        status: { in: ["active", "trialing"] },
        plan: { price: { gt: 0 } },
      },
      include: { plan: true },
    }),
  ]);

  const revenue = monthlyRevenue.reduce(
    (sum, sub) => sum + (sub.plan.price || 0),
    0,
  );

  return {
    totalUsers,
    totalTenants,
    activeSubscriptions,
    totalBots,
    totalContacts,
    totalConversations,
    recentSubscriptions,
    monthlyRevenue: revenue,
  };
}

export default async function AdminPage() {
  const stats = await getBusinessStats();

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Users
            </CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Tenants
            </CardTitle>
            <Activity className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalTenants}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Active Subscriptions
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.activeSubscriptions}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Monthly Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${stats.monthlyRevenue.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Bots
            </CardTitle>
            <Bot className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalBots}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Contacts
            </CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalContacts}</div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Conversations
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalConversations}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
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
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {sub.tenant.users[0]?.name ||
                        sub.tenant.users[0]?.email ||
                        "Unknown"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {sub.tenant.users[0]?.email || "No email"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">
                      {sub.plan.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      ${sub.plan.price}/month
                    </p>
                    <p className="text-xs text-gray-400 capitalize">
                      {sub.status}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
