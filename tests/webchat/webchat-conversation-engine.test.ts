import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    flowSession: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    flowChannelAssignment: {
      findFirst: vi.fn(),
    },
    flow: {
      findFirst: vi.fn(),
    },
    lead: {
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "lead_1" }),
      update: vi.fn().mockResolvedValue({ id: "lead_1" }),
    },
    contact: {
      update: vi.fn().mockResolvedValue({ id: "contact_1" }),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { executeWebchatFlowFirst } from "@/lib/webchat-conversation-engine";

const sourceContext = {
  origin: "https://www.vivescriptsolutions.com",
  referrer: "https://www.google.com/",
  locale: "en-GB",
  pageUrl: "https://www.vivescriptsolutions.com/",
  pageTitle: "ViveScript Solutions",
  userAgent: "Mozilla/5.0",
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmTerm: null,
  utmContent: null,
  firstSeenAt: "2026-04-09T10:00:00.000Z",
  lastSeenAt: "2026-04-09T10:01:00.000Z",
} as const;

describe("executeWebchatFlowFirst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.flowChannelAssignment.findFirst).mockResolvedValue(
      null as never,
    );
    vi.mocked(prisma.lead.findFirst).mockResolvedValue(null as never);
  });

  it("does not restart an entry flow after it already completed for the same visitor", async () => {
    vi.mocked(prisma.flowSession.findFirst).mockImplementation(((args: any) => {
      if (args?.where?.isActive === true) {
        return Promise.resolve(null as never);
      }

      if (args?.where?.completedAt) {
        return Promise.resolve({
          id: "sess_done_1",
          flowId: "flow_lead",
          completedAt: new Date("2026-04-09T10:00:00.000Z"),
        } as never);
      }

      return Promise.resolve(null as never);
    }) as never);

    vi.mocked(prisma.flow.findFirst).mockResolvedValue({
      id: "flow_lead",
      name: "Lead Intake Flow",
      isActive: true,
      fallbackMessage: null,
      nodes: [
        {
          id: "node_1",
          type: "message",
          order: 0,
          content: { text: "Thanks for reaching out" },
        },
      ],
    } as never);

    const result = await executeWebchatFlowFirst({
      tenantId: "tenant_1",
      botId: "bot_1",
      contactId: "contact_1",
      siteId: "site_1",
      channelId: "chan_1",
      entryFlow: "flow_lead",
      message: "Ok, thank you.",
      sourceContext: { ...sourceContext },
    });

    expect(result).toBeNull();
    expect(prisma.flowSession.create).not.toHaveBeenCalled();
  });

  it("creates a lead record from collected lead variables when tag_user runs", async () => {
    vi.mocked(prisma.flowSession.findFirst).mockImplementation(((args: any) => {
      if (args?.where?.isActive === true) {
        return Promise.resolve({
          id: "sess_active_1",
          flowId: "flow_lead",
          currentNodeId: "node_action",
          variables: {
            __runtime: {
              rootFlowId: "flow_lead",
              activeFlowId: "flow_lead",
              callStack: [],
            },
            lead_name: "Amir",
            lead_email: "amir@example.com",
            lead_phone: "+8801819062270",
            lead_need: "Need a TikTok inbox chatbot",
            lead_budget: "$30/month",
          },
          isActive: true,
        } as never);
      }

      return Promise.resolve(null as never);
    }) as never);

    vi.mocked(prisma.flow.findFirst).mockResolvedValue({
      id: "flow_lead",
      name: "Lead Intake Flow",
      isActive: true,
      fallbackMessage: null,
      nodes: [
        {
          id: "node_action",
          type: "action",
          order: 0,
          content: {
            action: "tag_user",
            tags: ["lead", "new-inquiry"],
          },
        },
        {
          id: "node_end",
          type: "end",
          order: 1,
          content: {},
        },
      ],
    } as never);

    const result = await executeWebchatFlowFirst({
      tenantId: "tenant_1",
      botId: "bot_1",
      contactId: "contact_1",
      siteId: "site_1",
      channelId: "chan_1",
      entryFlow: "flow_lead",
      message: "done",
      sourceContext: { ...sourceContext },
    });

    expect(result?.completed).toBe(true);
    expect(prisma.contact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "contact_1" },
        data: expect.objectContaining({
          name: "Amir",
          email: "amir@example.com",
          phone: "+8801819062270",
        }),
      }),
    );
    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant_1",
          contactId: "contact_1",
          name: "Amir",
          email: "amir@example.com",
          mobile: "+8801819062270",
          source: "website",
          status: "contacted",
        }),
      }),
    );
  });
});
