/**
 * Channel Configuration System
 *
 * Uses one unified data source in `lib/channel-config.data.ts`.
 * This removes per-channel environment lookups at runtime and keeps
 * channel decisions deterministic in both server and client code.
 *
 * Optional override (single env var):
 *   CHANNEL_CONFIG_OVERRIDES_JSON='{"facebook":{"enabled":false},"whatsapp":{"uiVisible":true}}'
 */

import {
  CHANNEL_CONFIG_DATA,
  type ChannelId,
  type ChannelConfigData,
} from "@/lib/channel-config.data";

export type { ChannelId };

export interface ChannelStatus {
  id: ChannelId;
  displayName: string;
  description: string;
  enabled: boolean;
  uiVisible: boolean;
  navVisible: boolean;
  notes?: string;
}

type ChannelOverrides = Partial<
  Record<
    ChannelId,
    Partial<Pick<ChannelConfigData, "enabled" | "uiVisible" | "navVisible">>
  >
>;

function parseOverrides(): ChannelOverrides {
  const raw = process.env.CHANNEL_CONFIG_OVERRIDES_JSON;
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as ChannelOverrides;
    return parsed;
  } catch {
    return {};
  }
}

function resolveChannelData(channelId: ChannelId): ChannelConfigData {
  const base = CHANNEL_CONFIG_DATA[channelId];
  const override = parseOverrides()[channelId] || {};

  const resolved = {
    ...base,
    ...override,
  };

  // If the channel is disabled, force all visibility to false
  if (!resolved.enabled) {
    return {
      ...resolved,
      uiVisible: false,
      navVisible: false,
    };
  }

  return resolved;
}

/**
 * Get full config for a single channel
 */
export function getChannelConfig(channelId: ChannelId): ChannelStatus {
  const data = resolveChannelData(channelId);
  return {
    id: channelId,
    displayName: data.displayName,
    description: data.description,
    enabled: data.enabled,
    uiVisible: data.uiVisible,
    navVisible: data.navVisible,
    notes: data.notes,
  };
}

/**
 * Get config for all channels
 */
export function getAllChannelConfigs(): ChannelStatus[] {
  return Object.keys(CHANNEL_CONFIG_DATA).map((id) =>
    getChannelConfig(id as ChannelId),
  );
}

/**
 * Check if a channel is enabled
 */
export function isChannelEnabled(channelId: ChannelId): boolean {
  return resolveChannelData(channelId).enabled;
}

/**
 * Get all enabled channels
 */
export function getEnabledChannels(): ChannelId[] {
  return (Object.keys(CHANNEL_CONFIG_DATA) as ChannelId[]).filter(
    isChannelEnabled,
  );
}

/**
 * Get all disabled channels
 */
export function getDisabledChannels(): ChannelId[] {
  return (Object.keys(CHANNEL_CONFIG_DATA) as ChannelId[]).filter(
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
  return resolveChannelData(channelId).uiVisible;
}

/**
 * Returns true when a channel should be shown in navigation sidebars.
 */
export function isChannelNavVisible(channelId: ChannelId): boolean {
  return resolveChannelData(channelId).navVisible;
}

export function getUiVisibleChannels(): ChannelStatus[] {
  return getAllChannelConfigs().filter((channel) =>
    isChannelVisibleInUi(channel.id),
  );
}

export function getNavVisibleChannels(): ChannelStatus[] {
  return getAllChannelConfigs().filter((channel) =>
    isChannelNavVisible(channel.id),
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
        `Enable it in lib/channel-config.data.ts or via CHANNEL_CONFIG_OVERRIDES_JSON.`,
    );
  }
}

/**
 * Optional override structure when using CHANNEL_CONFIG_OVERRIDES_JSON:
 * {
 *   "facebook": { "enabled": true, "uiVisible": true },
 *   "telegram": { "enabled": true, "uiVisible": true },
 *   "webchat": { "enabled": true, "uiVisible": true },
 *   "whatsapp": { "enabled": true, "uiVisible": true }
 * }
 */
export const CHANNEL_OVERRIDE_ENV = "CHANNEL_CONFIG_OVERRIDES_JSON";
