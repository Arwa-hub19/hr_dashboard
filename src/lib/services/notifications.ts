import { db } from "../db";
import * as s from "../db/schema";
import { v4 as uuid } from "uuid";
import type { NotificationType } from "../types";

/* ═══════════════════════════════════════════════════
   NOTIFICATION DISPATCH ABSTRACTION
   
   Current: writes to DB (in-app notifications)
   Future: add OutlookDispatcher via Microsoft Graph API
   
   To add Outlook:
   1. Implement OutlookDispatcher below
   2. Register it in dispatchers array
   3. No other code changes needed
   ═══════════════════════════════════════════════════ */

export interface NotificationPayload {
  recipientId: string;
  recipientEmail?: string; // needed for external dispatch
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
}

export interface NotificationDispatcher {
  name: string;
  send(payload: NotificationPayload): Promise<void>;
}

/* ─── Built-in: Database dispatcher (in-app) ─── */

class DatabaseDispatcher implements NotificationDispatcher {
  name = "database";

  async send(payload: NotificationPayload): Promise<void> {
    await db.insert(s.notifications).values({
      id: uuid(),
      recipientId: payload.recipientId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      data: payload.data ? JSON.stringify(payload.data) : null,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  }
}

/* ─── Future: Outlook dispatcher (stub) ─── */

// class OutlookDispatcher implements NotificationDispatcher {
//   name = "outlook";
//
//   async send(payload: NotificationPayload): Promise<void> {
//     // Microsoft Graph API call:
//     // POST https://graph.microsoft.com/v1.0/me/sendMail
//     // Headers: Authorization: Bearer {access_token}
//     // Body: { message: { subject, body, toRecipients: [{ emailAddress: { address } }] } }
//     //
//     // Requires:
//     // 1. Azure AD app registration with Mail.Send permission
//     // 2. OAuth2 token from user or service principal
//     // 3. MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID env vars
//   }
// }

/* ─── Dispatcher registry ─── */

const dispatchers: NotificationDispatcher[] = [
  new DatabaseDispatcher(),
  // new OutlookDispatcher(), // uncomment when ready
];

/* ─── Public API ─── */

export async function dispatchNotification(payload: NotificationPayload): Promise<void> {
  for (const dispatcher of dispatchers) {
    try {
      await dispatcher.send(payload);
    } catch (err) {
      console.error(`[Notification] ${dispatcher.name} dispatch failed:`, err);
    }
  }
}

/* ─── Convenience functions for common notification types ─── */

export async function notifyReviewSubmitted(
  adminUserId: string,
  employeeName: string,
  assessorName: string,
  quadrant: string,
  employeeId: string
) {
  await dispatchNotification({
    recipientId: adminUserId,
    type: "review_submitted",
    title: "Assessment Submitted",
    message: `${assessorName} has submitted a review for ${employeeName}. Result: ${quadrant}.`,
    data: { employeeId, quadrant },
  });
}

export async function notifyStarPerformer(
  adminUserId: string,
  employeeName: string,
  score: number,
  employeeId: string
) {
  await dispatchNotification({
    recipientId: adminUserId,
    type: "star_performer",
    title: "Star Performer Alert",
    message: `${employeeName} has scored ${score.toFixed(1)} across both dimensions — exceeding the star threshold.`,
    data: { employeeId, score },
  });
}

export async function notifyLowScore(
  adminUserId: string,
  context: string,
  count: number,
  departmentId?: string
) {
  await dispatchNotification({
    recipientId: adminUserId,
    type: "low_score_alert",
    title: "Low Score Alert",
    message: `${context}: ${count} employee(s) flagged below the low-score threshold.`,
    data: { departmentId, count },
  });
}

export async function notifyCycleReminder(
  adminUserId: string,
  cycleName: string,
  pendingCount: number,
  cycleId: string
) {
  await dispatchNotification({
    recipientId: adminUserId,
    type: "cycle_reminder",
    title: "Pending Reviews Reminder",
    message: `${cycleName} cycle: ${pendingCount} employee(s) still pending assessment.`,
    data: { cycleId, pendingCount },
  });
}

/* ═══════════════════════════════════════════════════
   USER DIRECTORY ABSTRACTION (for future SSO)
   
   Current: reads from local users table
   Future: Microsoft Graph /users endpoint
   ═══════════════════════════════════════════════════ */

export interface UserDirectoryProvider {
  name: string;
  getUser(userId: string): Promise<{ id: string; email: string; name: string } | null>;
  searchUsers(query: string): Promise<{ id: string; email: string; name: string }[]>;
}

// class MicrosoftGraphDirectory implements UserDirectoryProvider {
//   name = "microsoft-graph";
//   async getUser(userId: string) { /* GET /users/{id} */ return null; }
//   async searchUsers(query: string) { /* GET /users?$search= */ return []; }
// }
