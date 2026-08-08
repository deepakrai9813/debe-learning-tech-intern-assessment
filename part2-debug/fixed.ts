import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

/**
 * Shared, explicit result type.
 *
 * BUG 4 (typing) — the original had no return type at all: the handler mixed a
 * synchronous `{ success: false }` return with an un-awaited async write, so the
 * compiler inferred a sloppy union and a floating Promise that TypeScript could
 * not track. Declaring `Promise<BookingResult>` forces every code path to await
 * its work and return the same shape, and gives callers a contract they can rely
 * on. In a real deployment this same interface would be shared with the client.
 */
interface BookingResult {
  success: boolean;
  message?: string;
}

interface BookingRequest {
  studentId: string;
  teacherId: string;
  slot: string; // ISO datetime string
  subject: string;
}

export const bookSession = functions.https.onCall(
  async (data: BookingRequest | undefined, context): Promise<BookingResult> => {
    /**
     * BUG 4 (typing, cont.) — in the callable SDK, `data` is typed as `any` and
     * callers can invoke the function with no arguments, so `data` may be
     * `undefined` at runtime. Narrowing it (and validating that required fields
     * are actually strings) turns a would-be `TypeError`/`undefined` crash into a
     * clean, typed client error instead of a confusing 500. This guard also runs
     * BEFORE the authorization checks so the error always matches the cause.
     */
    if (!data) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "A booking payload is required."
      );
    }

    /**
     * BUG 1 (security) — `context.auth` was never checked. Anyone could invoke
     * this endpoint — including unauthenticated callers — and book sessions for
     * any student or teacher, and the function would happily write to Firestore.
     * In production this is an auth bypass: an attacker can spam bookings or
     * block a teacher's calendar (denial of service), and Firestore billing gets
     * charged for every forged write. We reject unauthenticated callers and then
     * confirm the caller is the student they claim to be. (For a guardian booking
     * on behalf of a child you would also verify a parent↔student mapping here.)
     */
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be signed in to book a session."
      );
    }
    if (context.auth.uid !== data.studentId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You can only book sessions for yourself."
      );
    }

    for (const field of ["studentId", "teacherId", "slot", "subject"] as const) {
      if (typeof data[field] !== "string" || data[field].length === 0) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          `Field "${field}" must be a non-empty string.`
        );
      }
    }

    const slot = new Date(data.slot);
    if (Number.isNaN(slot.getTime()) || slot.getTime() <= Date.now()) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Slot must be a valid ISO datetime in the future."
      );
    }

    /**
     * BUG 2 (async/await) — `.get()` was never awaited. `existing` was a Promise,
     * and `existing.docs` does not exist on a Promise, so the double-booking
     * check would throw a runtime error (or, depending on the SDK version, read
     * `undefined.length` and crash the whole function). Likewise `.add()` below
     * was a floating promise: the function could return `{ success: true }`
     * before the write even hit Firestore, and a callable function's background
     * work can be terminated at any time — silently losing the booking.
     *
     * BUG 3 (logic) — the original checked `teachers/{teacherId}/bookings` but
     * then WROTE to the top-level `bookings` collection. Those are two different
     * locations, so the "slot already booked" check could never match a real
     * conflict: double-bookings silently slipped through. Beyond the mismatch,
     * a check-then-insert race means two concurrent requests could both pass the
     * check. `runTransaction` fixes both problems: the query and the write are
     * atomic, and both operate on the SAME path (the teacher's subcollection).
     * (Note: querying inside a transaction requires the Admin SDK v6+, which is
     * the current standard — older SDKs only support point-reads in transactions.)
     *
     * We also compare slots by a NORMALIZED epoch number (`slotEpoch`) rather
     * than the raw ISO string: `"2026-08-09T16:00:00Z"` and
     * `"2026-08-09T16:00:00.000Z"` are the same instant but different strings,
     * and string-equality on them would let a duplicate slip through.
     */
    return db.runTransaction(async (tx) => {
      const teacherRef = db.collection("teachers").doc(data.teacherId);
      const existing = await tx.get(
        teacherRef.collection("bookings").where("slotEpoch", "==", slot.getTime())
      );

      if (!existing.empty) {
        return { success: false, message: "Slot already booked" };
      }

      await tx.set(teacherRef.collection("bookings").doc(), {
        studentId: data.studentId,
        teacherId: data.teacherId,
        slot: data.slot,
        slotEpoch: slot.getTime(),
        subject: data.subject,
        status: "confirmed",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true };
    });
  }
);
