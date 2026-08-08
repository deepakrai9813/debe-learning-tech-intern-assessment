import type { TutoringSession } from "@/shared/types";

/**
 * Mock data — simulates a Firestore query for the student's next 3 upcoming
 * sessions. A static JSON array would be fine, but generating the datetimes
 * relative to "now" (in UTC) keeps the demo honest forever: the sessions are
 * always genuinely upcoming, so the "must be in the future" and 2-hour-lockout
 * rules behave exactly as they would in production.
 *
 * All datetimes are UTC ISO-8601 strings ending in "Z" (see src/lib/time.ts).
 */
function daysFromNowUtc(days: number, hourUtc: number, minuteUtc = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hourUtc, minuteUtc, 0, 0);
  return d.toISOString();
}

export const MOCK_SESSIONS: TutoringSession[] = [
  {
    id: "sess-001",
    subject: "Mathematics · Algebra II",
    teacherName: "Ms. Aisha Okafor",
    datetimeUtc: daysFromNowUtc(1, 16, 0),
    status: "confirmed",
  },
  {
    id: "sess-002",
    subject: "Physics · Kinematics",
    teacherName: "Mr. Daniel Reyes",
    datetimeUtc: daysFromNowUtc(3, 14, 30),
    status: "confirmed",
  },
  {
    id: "sess-003",
    subject: "English Literature · Essay Prep",
    teacherName: "Ms. Priya Sharma",
    datetimeUtc: daysFromNowUtc(5, 9, 30),
    status: "pending",
  },
];

/** Simulated server lookup (the deployed function would read this from Firestore). */
export function findMockSession(sessionId: string): TutoringSession | undefined {
  return MOCK_SESSIONS.find((s) => s.id === sessionId);
}
