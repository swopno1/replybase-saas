/**
 * Channel Configuration System
 *
 * This module manages which communication channels are enabled/disabled.
 * Each channel can be toggled via environment variables without code changes.
 *
 * Usage:
 *   import { getChannelConfig, isChannelEnabled } from '@/lib/channel-config';
 *
 *   if (isChannelEnabled('facebook')) {
 *     // Facebook features available
 *   }
 */

export type ChannelId = "facebook" | "telegram" | "webchat" | "whatsapp";

export interface ChannelStatus {
  id: ChannelId;
  displayName: string;
  description: string;
  enabled: boolean;
  envVar: string;
  notes?: string;
}

const CHANNEL_DEFAULTS: Record<ChannelId, Omit<ChannelStatus, "enabled">> = {
  facebook: {
    id: "facebook",
    displayName: "Facebook Messenger",
    description: "Meta Facebook Messenger integration",
    envVar: "ENABLE_CHANNEL_FACEBOOK",
    notes:
      "Requires Meta App verification. Currently disabled due to verification failure.",
  },
  telegram: {
    id: "telegram",
    displayName: "Telegram",
    description: "Telegram Bot integration",
    envVar: "ENABLE_CHANNEL_TELEGRAM",
    notes: "Production ready",
  },
  webchat: {
    id: "webchat",
    displayName: "Web Chat",
    description: "Embedded webchat widget for websites",
    envVar: "ENABLE_CHANNEL_WEBCHAT",
    notes: "Production ready",
  },
  whatsapp: {
    id: "whatsapp",
    displayName: "WhatsApp",
    description: "WhatsApp Business API integration",
    envVar: "ENABLE_CHANNEL_WHATSAPP",
    notes: "In development",
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
  const base = CHANNEL_DEFAULTS[channelId];
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
 * Default channel status: Facebook is disabled
 * Set the following environment variables to enable/disable channels:
 *   ENABLE_CHANNEL_FACEBOOK=true    # Facebook - currently disabled due to Meta verification failure
 *   ENABLE_CHANNEL_TELEGRAM=true    # Telegram - default enabled
 *   ENABLE_CHANNEL_WEBCHAT=true     # Web Chat - default enabled
 *   ENABLE_CHANNEL_WHATSAPP=true    # WhatsApp - optional
 */
export const CHANNEL_DEFAULTS_ENV = {
  facebook: "false", // Currently disabled - Meta verification failed
  telegram: "true",
  webchat: "true",
  whatsapp: "false",
};
