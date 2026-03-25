/**
 * Channel Configuration System
 *
 * This module manages which communication channels are enabled/disabled,
 * and which are visible in the UI.  Both dimensions are controlled via
 * environment variables without code changes.
 *
 * Backend enablement:
 *   ENABLE_CHANNEL_FACEBOOK=true    # allow Facebook API routes
 *   ENABLE_CHANNEL_TELEGRAM=true    # allow Telegram API routes
 *   ENABLE_CHANNEL_WEBCHAT=true     # allow Webchat API routes
 *   ENABLE_CHANNEL_WHATSAPP=true    # allow WhatsApp API routes
 *
 * UI visibility (independent of backend enablement):
 *   ENABLE_UI_CHANNEL_FACEBOOK=true    # show Facebook surfaces in the UI
 *   ENABLE_UI_CHANNEL_WHATSAPP=true    # show WhatsApp surfaces in the UI
 *
 * When a UI env var is absent the channel falls back to the hardcoded
 * `uiVisibleByDefault` flag defined in CHANNEL_DEFAULTS below.
 *
 * Usage:
 *   import { getChannelConfig, isChannelEnabled, isChannelVisibleInUi } from '@/lib/channel-config';
 *
 *   if (isChannelEnabled('facebook')) { ... }      // backend gate
 *   if (isChannelVisibleInUi('facebook')) { ... }  // UI gate
 */

export type ChannelId = "facebook" | "telegram" | "webchat" | "whatsapp";

export interface ChannelStatus {
  id: ChannelId;
  displayName: string;
  description: string;
  enabled: boolean;
  envVar: string;
  /** Env var that controls whether this channel appears in the UI.
   *  When absent, `uiVisibleByDefault` is used. */
  uiEnvVar?: string;
  notes?: string;
}

const CHANNEL_DEFAULTS: Record<
  ChannelId,
  Omit<ChannelStatus, "enabled"> & { uiVisibleByDefault: boolean }
> = {
  facebook: {
    id: "facebook",
    displayName: "Facebook Messenger",
    description: "Meta Facebook Messenger integration",
    envVar: "ENABLE_CHANNEL_FACEBOOK",
    uiEnvVar: "ENABLE_UI_CHANNEL_FACEBOOK",
    uiVisibleByDefault: false,
    notes:
      "Requires Meta App verification. Currently hidden from UI; set ENABLE_UI_CHANNEL_FACEBOOK=true to restore.",
  },
  telegram: {
    id: "telegram",
    displayName: "Telegram",
    description: "Telegram Bot integration",
    envVar: "ENABLE_CHANNEL_TELEGRAM",
    uiVisibleByDefault: true,
    notes: "Production ready",
  },
  webchat: {
    id: "webchat",
    displayName: "Web Chat",
    description: "Embedded webchat widget for websites",
    envVar: "ENABLE_CHANNEL_WEBCHAT",
    uiVisibleByDefault: true,
    notes: "Production ready",
  },
  whatsapp: {
    id: "whatsapp",
    displayName: "WhatsApp",
    description: "WhatsApp Business API integration",
    envVar: "ENABLE_CHANNEL_WHATSAPP",
    uiEnvVar: "ENABLE_UI_CHANNEL_WHATSAPP",
    uiVisibleByDefault: false,
    notes: "In development. Set ENABLE_UI_CHANNEL_WHATSAPP=true to show in UI.",
  },
};

/**
 * Parse environment variable to boolean
 * Accepts: true, 'true', '1', 'yes' as true
 * Accepts: false, 'false', '0', 'no', undefined as false
 */
function parseBoolEnv(value: string | undefined): boolean {
  if (!value) return false;
  return ["true", "1", "yes"].includes(value.toLowerCase());
}

/**
 * Get the enabled status for a specific channel
 */
function isChannelEnabledInternal(channelId: ChannelId): boolean {
  const channel = CHANNEL_DEFAULTS[channelId];
  const envValue = process.env[channel.envVar] || "false";
  return parseBoolEnv(envValue);
}

/**
 * Get full config for a single channel
 */
export function getChannelConfig(channelId: ChannelId): ChannelStatus {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { uiVisibleByDefault, ...base } = CHANNEL_DEFAULTS[channelId];
  return {
    ...base,
    enabled: isChannelEnabledInternal(channelId),
  };
}

/**
 * Get config for all channels
 */
export function getAllChannelConfigs(): ChannelStatus[] {
  return Object.keys(CHANNEL_DEFAULTS).map((id) =>
    getChannelConfig(id as ChannelId),
  );
}

/**
 * Check if a channel is enabled
 */
export function isChannelEnabled(channelId: ChannelId): boolean {
  return isChannelEnabledInternal(channelId);
}

/**
 * Get all enabled channels
 */
export function getEnabledChannels(): ChannelId[] {
  return (Object.keys(CHANNEL_DEFAULTS) as ChannelId[]).filter(
    isChannelEnabled,
  );
}

/**
 * Get all disabled channels
 */
export function getDisabledChannels(): ChannelId[] {
  return (Object.keys(CHANNEL_DEFAULTS) as ChannelId[]).filter(
    (id) => !isChannelEnabled(id),
  );
}

/**
 * Returns true when a channel should be shown in the UI.
 *
 * Resolution order (first match wins):
 *  1. If the channel defines `uiEnvVar` AND that env var is set → use its value
 *  2. Otherwise fall back to the `uiVisibleByDefault` flag in CHANNEL_DEFAULTS
 *
 * Examples:
 *   ENABLE_UI_CHANNEL_FACEBOOK=true  → Facebook surfaces appear in the UI
 *   ENABLE_UI_CHANNEL_FACEBOOK=false → Facebook surfaces are hidden (same as default)
 *   (unset)                          → falls back to uiVisibleByDefault (false for facebook)
 */
export function isChannelVisibleInUi(channelId: ChannelId): boolean {
  const { uiEnvVar, uiVisibleByDefault } = CHANNEL_DEFAULTS[channelId];
  if (uiEnvVar !== undefined && process.env[uiEnvVar] !== undefined) {
    return parseBoolEnv(process.env[uiEnvVar]);
  }
  return uiVisibleByDefault;
}

export function getUiVisibleChannels(): ChannelStatus[] {
  return getAllChannelConfigs().filter((channel) =>
    isChannelVisibleInUi(channel.id),
  );
}

/**
 * Assert that a channel is enabled, throw error if not
 */
export function requireChannelEnabled(
  channelId: ChannelId,
  context?: string,
): void {
  if (!isChannelEnabled(channelId)) {
    const contextStr = context ? ` (${context})` : "";
    throw new Error(
      `Channel '${channelId}' is not enabled${contextStr}. ` +
        `Set environment variable ENABLE_CHANNEL_${channelId.toUpperCase()} to enable it.`,
    );
  }
}

/**
 * Default channel status summary:
 *
 * Backend enablement (API routes):
 *   ENABLE_CHANNEL_FACEBOOK=true    # off by default — Meta verification failed
 *   ENABLE_CHANNEL_TELEGRAM=true    # on by default
 *   ENABLE_CHANNEL_WEBCHAT=true     # on by default
 *   ENABLE_CHANNEL_WHATSAPP=true    # off by default — in development
 *
 * UI visibility (dashboard surfaces, sidebar, settings):
 *   ENABLE_UI_CHANNEL_FACEBOOK=true   # hidden by default — set to show Facebook UI
 *   ENABLE_UI_CHANNEL_WHATSAPP=true   # hidden by default — set to show WhatsApp UI
 *
 * Telegram and Webchat are always visible in the UI (no env var needed).
 */
export const CHANNEL_DEFAULTS_ENV = {
  facebook: "false", // Currently disabled - Meta verification failed
  telegram: "true",
  webchat: "true",
  whatsapp: "false",
};
