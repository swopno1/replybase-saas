"use server";

import {
  getLiveWebchatSessions,
  getWebchatAnalytics,
  getSessionHistory,
  getAdminWebchatMonitoringSnapshot
} from "@/lib/admin-webchat-monitoring";

export async function fetchLiveWebchatSessions() {
  return getLiveWebchatSessions();
}

export async function fetchWebchatAnalytics() {
  return getWebchatAnalytics();
}

export async function fetchSessionHistory(sessionId: string) {
  return getSessionHistory(sessionId);
}

export async function fetchAdminWebchatMonitoringSnapshot() {
  return getAdminWebchatMonitoringSnapshot();
}
