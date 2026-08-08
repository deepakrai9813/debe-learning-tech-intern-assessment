import { LEAD_TIME_MINUTES } from "@/lib/time";
import { findMockSession } from "@/lib/sessions";
import type {
  RescheduleReason,
  RescheduleRequest,
  RescheduleResponse,
} from "@/shared/types";

const VALID_REASONS: readonly RescheduleReason[] = [
  "Conflict",
  "Illness",
  "Time zone",
  "Other",
];

/**
 * Mock of the Firebase Cloud Function `requestReschedule`.
 *
 * In production this file's body would be deployed as a callable Cloud Function
 * (`functions.https.onCall(...)`) that imports the SAME `@/shared/types` —
 * the request/response contract below is identical in both worlds. The only
 * thing simulated here is the network round-trip (a short delay) and the
 * Firestore read (see `findMockSession`), so the UI's loading and error states
 * behave exactly like they would against a real deployment.
 *
 * Validation performed server-side (mirrored + enforced in the UI):
 *   1. The new slot must be a valid datetime.
 *   2. The new slot must be in the FUTURE — no booking into the past.
 *   3. The new slot must DIFFER from the session's current slot.
 *   4. The new slot must respect the 2-hour lead-time policy (the UI disables
 *      such slots; the server re-checks because clients can be bypassed).
 *   5. The new slot must fall within the 30-day advance-notice window. This rule
 *      is deliberately NOT pre-blocked in the UI so the typed `error` response
 *      path is genuinely reachable (a parent picking a date too far ahead), and
 *      it keeps the UI/function contract honest: the function is the source of
 *      truth for policy.
 */

/** Reschedules can only be requested this many days ahead of the new slot. */
const MAX_ADVANCE_DAYS = 30;
export async function requestReschedule(
  request: RescheduleRequest
): Promise<RescheduleResponse> {
  // Simulate a network round-trip so the UI's loading state is visible & honest.
  await new Promise((resolve) => setTimeout(resolve, 700));

  const session = findMockSession(request.sessionId);
  if (!session) {
    return { success: false, error: "Session not found. Refresh and try again." };
  }

  // Runtime validation of the reason (defense in depth — the type only guards
  // compile time; deployed functions must re-validate untrusted client input).
  if (!VALID_REASONS.includes(request.reason)) {
    return { success: false, error: "Please choose a valid reason." };
  }

  const newSlot = new Date(request.newSlotUtc);
  if (Number.isNaN(newSlot.getTime())) {
    return { success: false, error: "That date/time is invalid. Try another slot." };
  }

  const now = Date.now();

  if (newSlot.getTime() <= now) {
    return { success: false, error: "The new slot must be in the future." };
  }

  // Compare instants; treat sub-minute differences as "identical" so a parent
  // re-picking the same session slot (e.g. a differing second value) is caught.
  const isIdenticalToCurrent = Math.abs(newSlot.getTime() - new Date(session.datetimeUtc).getTime()) < 60_000;
  if (isIdenticalToCurrent) {
    return { success: false, error: "The new slot is identical to the current session time." };
  }

  if (newSlot.getTime() - now < LEAD_TIME_MINUTES * 60_000) {
    return {
      success: false,
      error: `Sessions must be booked at least 2 hours ahead. Please pick a later slot.`,
    };
  }

  if (newSlot.getTime() - now > MAX_ADVANCE_DAYS * 24 * 60 * 60 * 1000) {
    return {
      success: false,
      error: `Reschedules can be requested up to ${MAX_ADVANCE_DAYS} days in advance. Please pick a closer date.`,
    };
  }

  // In production: write the reschedule request to Firestore (e.g. a
  // `rescheduleRequests` collection with status "pending") and return success.
  return { success: true };
}

/**
 * What the deployed Firebase callable would look like — same validation, same
 * shared types, plus the auth gate callable functions enforce. Kept here so the
 * "frontend calls a Cloud Function" story is literally true in the codebase.
 */
export async function requestRescheduleOnCall(
  data: RescheduleRequest | undefined,
  context: { auth?: { uid: string } | null }
): Promise<RescheduleResponse> {
  if (!context.auth) {
    return { success: false, error: "You must be signed in to request a reschedule." };
  }
  if (!data) {
    return { success: false, error: "A reschedule request payload is required." };
  }
  return requestReschedule(data);
}
