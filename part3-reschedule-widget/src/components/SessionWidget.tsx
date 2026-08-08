"use client";

import { useEffect, useState } from "react";
import { RescheduleForm } from "@/components/RescheduleForm";
import { SessionCard } from "@/components/SessionCard";
import { MOCK_SESSIONS } from "@/lib/sessions";
import { getLocalTimezone } from "@/lib/time";
import { useMounted } from "@/lib/useMounted";
import type { TutoringSession } from "@/shared/types";

export function SessionWidget() {
  // Mock data stands in for a Firestore query (see src/lib/sessions.ts).
  const [sessions, setSessions] = useState<TutoringSession[]>(MOCK_SESSIONS);
  const [activeSession, setActiveSession] = useState<TutoringSession | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The browser's timezone (shown in the header chip) is unknown to the server,
  // so it is only rendered after hydration to avoid an SSR/client mismatch.
  const mounted = useMounted();

  // Auto-dismiss the success banner after a few seconds.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  function handleSuccess(sessionId: string, newSlotUtc: string) {
    // Reflect the rescheduled time in the list so the widget stays truthful.
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, datetimeUtc: newSlotUtc } : s))
    );
    setActiveSession(null);
    setNotice("Reschedule requested! We'll confirm the new time shortly.");
  }

  return (
    <section className="widget" aria-label="Upcoming tutoring sessions">
      <header className="widget__header">
        <div>
          <h1 className="widget__title">Upcoming sessions</h1>
          <p className="widget__subtitle">Alex's next tutoring sessions</p>
        </div>
        <span className="widget__tz-chip" title="All session times are shown in your local timezone">
          🌍 {mounted ? getLocalTimezone() : "…"}
        </span>
      </header>

      {notice && (
        <div className="notice" role="status">
          <span className="notice__check" aria-hidden="true">
            ✓
          </span>
          {notice}
        </div>
      )}

      <div className="session-list">
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            mounted={mounted}
            onRequestReschedule={setActiveSession}
          />
        ))}
      </div>

      <p className="widget__footnote">
        Times are stored in UTC and shown in your local time. Reschedules require at
        least 2 hours&apos; notice — earlier slots are disabled.
      </p>

      {activeSession && (
        <RescheduleForm
          session={activeSession}
          onClose={() => setActiveSession(null)}
          onSuccess={(newSlotUtc) => handleSuccess(activeSession.id, newSlotUtc)}
        />
      )}
    </section>
  );
}
