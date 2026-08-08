/**
 * Shared types — imported by BOTH the frontend (widget + form) and the
 * `requestReschedule` Cloud Function (mocked locally in `src/lib/requestReschedule.ts`).
 *
 * In a real deployment these types would live in a shared package (or a
 * `functions/shared` folder) referenced by the Next.js app and the Cloud
 * Function, so the request/response contract can never drift between the two.
 * No `any` anywhere — every boundary is typed.
 */

export type SessionStatus = "confirmed" | "pending" | "cancelled";

/** The allowed reasons for a reschedule, per the product spec. */
export type RescheduleReason = "Conflict" | "Illness" | "Time zone" | "Other";

export interface TutoringSession {
  id: string;
  subject: string;
  teacherName: string;
  /**
   * ISO-8601 UTC datetime string, always ending in "Z" (e.g. `2026-08-09T16:00:00.000Z`).
   * We deliberately store UTC, never local wall-clock time — a parent in New York and a
   * parent in Mumbai must see the same underlying instant, formatted in their own timezone.
   */
  datetimeUtc: string;
  status: SessionStatus;
}

export interface RescheduleRequest {
  sessionId: string;
  /** The new slot, as an ISO-8601 UTC datetime string. See `src/lib/time.ts`. */
  newSlotUtc: string;
  reason: RescheduleReason;
}

/** Typed response contract shared with the Cloud Function. */
export interface RescheduleResponse {
  success: boolean;
  /** Human-readable reason, present when `success` is false. */
  error?: string;
}
