export type ChannelId = "facebook" | "telegram" | "webchat" | "whatsapp";

export type ChannelConfigData = {
  displayName: string;
  description: string;
  enabled: boolean;
  uiVisible: boolean;
  notes?: string;
};

export const CHANNEL_CONFIG_DATA: Record<ChannelId, ChannelConfigData> = {
  facebook: {
    displayName: "Facebook Messenger",
    description: "Meta Facebook Messenger integration",
    enabled: true,
    uiVisible: true,
    notes: "Meta verified and active",
  },
  telegram: {
    displayName: "Telegram",
    description: "Telegram Bot integration",
    enabled: true,
    uiVisible: false,
    notes: "Production ready",
  },
  webchat: {
    displayName: "Web Chat",
    description: "Embedded webchat widget for websites",
    enabled: true,
    uiVisible: true,
    notes: "Production ready",
  },
  whatsapp: {
    displayName: "WhatsApp",
    description: "WhatsApp Business Cloud API integration",
    enabled: true,
    uiVisible: false,
    notes: "Meta verified and active",
  },
};
