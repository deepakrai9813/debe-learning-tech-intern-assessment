"use client";

import { formatLocalDateTime, utcOffsetLabelAt } from "@/lib/time";
import type { SessionStatus, TutoringSession } from "@/shared/types";

const STATUS_LABEL: Record<SessionStatus, string> = {
  confirmed: "Confirmed",
  pending: "Pending",
  cancelled: "Cancelled",
};

interface SessionCardProps {
  session: TutoringSession;
  /** Whether the client has hydrated — gates timezone-dependent rendering. */
  mounted: boolean;
  onRequestReschedule: (session: TutoringSession) => void;
}

export function SessionCard({ session, mounted, onRequestReschedule }: SessionCardProps) {
  return (
    <article className="session-card">
      <div className="session-card__top">
        <h3 className="session-card__subject">{session.subject}</h3>
        <span className={`badge badge--${session.status}`}>
          {STATUS_LABEL[session.status]}
        </span>
      </div>

      <p className="session-card__teacher">With {session.teacherName}</p>

      {/* Datetime is stored as UTC and rendered in the parent's LOCAL timezone —
          the label makes that conversion visible. The value is only rendered
          after mount: during SSR the server doesn't know the parent's timezone,
          so a placeholder avoids a hydration mismatch (see src/lib/useMounted.ts). */}
      <p className="session-card__time">
        {mounted ? (
          <>
            {formatLocalDateTime(session.datetimeUtc)}{" "}
            <span className="session-card__tz">
              · your time ({utcOffsetLabelAt(session.datetimeUtc)})
            </span>
          </>
        ) : (
          <span className="session-card__time-placeholder" aria-hidden="true">
            Loading your local time…
          </span>
        )}
      </p>

      <div className="session-card__actions">
        <button
          type="button"
          className="btn btn--outline"
          onClick={() => onRequestReschedule(session)}
        >
          Request reschedule
        </button>
      </div>
    </article>
  );
}
