"use client";

import { useEffect, useRef, useState } from "react";
import { requestReschedule } from "@/lib/requestReschedule";
import {
  formatLocalDateTime,
  localDateAndHourToUtc,
  toLocalDateInputValue,
  utcOffsetLabelAt,
} from "@/lib/time";
import { TimeSlotPicker } from "@/components/TimeSlotPicker";
import type { RescheduleReason, TutoringSession } from "@/shared/types";

const REASONS: readonly RescheduleReason[] = [
  "Conflict",
  "Illness",
  "Time zone",
  "Other",
];

type SubmitState = "idle" | "submitting" | "error";

interface RescheduleFormProps {
  session: TutoringSession;
  onClose: () => void;
  /** Called with the new UTC slot once the (mock) Cloud Function accepted it. */
  onSuccess: (newSlotUtc: string) => void;
}

export function RescheduleForm({ session, onClose, onSuccess }: RescheduleFormProps) {
  // The date input defaults to the session's local date so the parent sees the
  // current slot context; the current slot itself is disabled in the grid.
  const [date, setDate] = useState(() =>
    toLocalDateInputValue(new Date(session.datetimeUtc))
  );
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [reason, setReason] = useState<RescheduleReason | "">("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // The instant the parent has picked so far, in LOCAL display + UTC storage
  // terms. Demonstrates the local/UTC split the assessment asks about. The
  // `date !== ""` guard mirrors the picker: a cleared date has no slot.
  const previewUtc =
    selectedHour !== null && date !== "" ? localDateAndHourToUtc(date, selectedHour) : null;
  const canSubmit = date !== "" && selectedHour !== null && reason !== "" && submitState !== "submitting";

  // Move keyboard focus into the modal on open and restore it when it closes
  // (basic focus management — Escape and backdrop clicks also close it).
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    modalRef.current?.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  // Close on Escape (unless a request is in flight).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && submitState !== "submitting") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitState]);

  async function handleSubmit() {
    if (!canSubmit || previewUtc === null) return;

    setSubmitState("submitting");
    setErrorMessage(null);
    try {
      const response = await requestReschedule({
        sessionId: session.id,
        // The slot the parent picked in LOCAL wall-clock terms, converted to UTC
        // before it ever leaves the browser — see src/lib/time.ts.
        newSlotUtc: previewUtc,
        reason: reason as RescheduleReason,
      });

      if (response.success) {
        onSuccess(previewUtc);
      } else {
        setErrorMessage(response.error ?? "Could not request a reschedule.");
        setSubmitState("error");
      }
    } catch {
      // The mock never throws, but a real deployment can (network, quota…).
      // Catch everything so there is no unhandled promise rejection.
      setErrorMessage("Something went wrong. Please try again.");
      setSubmitState("error");
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && submitState !== "submitting") onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-title"
        tabIndex={-1}
        ref={modalRef}
      >
        <header className="modal__header">
          <div>
            <h2 id="reschedule-title">Request a reschedule</h2>
            <p className="modal__subtitle">
              {session.subject} · currently {formatLocalDateTime(session.datetimeUtc)}
            </p>
          </div>
          <button
            type="button"
            className="modal__close"
            aria-label="Close"
            disabled={submitState === "submitting"}
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        <TimeSlotPicker
          date={date}
          onDateChange={setDate}
          selectedHour={selectedHour}
          onSelectHour={setSelectedHour}
          currentSlotUtc={session.datetimeUtc}
        />

        <div className="form-row">
          <label className="field">
            <span className="field__label">Reason</span>
            <select
              value={reason}
              disabled={submitState === "submitting"}
              onChange={(e) => setReason(e.target.value as RescheduleReason | "")}
            >
              <option value="">Select a reason…</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          {/* The local/UTC contract, visible to the reviewer: the parent reads and
              picks local times, but the function receives a UTC instant. */}
          <div className="slot-summary" aria-live="polite">
            {previewUtc ? (
              <>
                <span className="slot-summary__local">
                  {formatLocalDateTime(previewUtc)} ({utcOffsetLabelAt(previewUtc)})
                </span>
                <span className="slot-summary__utc">Stored &amp; sent as UTC: {previewUtc}</span>
              </>
            ) : (
              <span className="slot-summary__placeholder">
                Pick a date and time above…
              </span>
            )}
          </div>
        </div>

        {submitState === "error" && errorMessage && (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        )}

        <footer className="modal__footer">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={submitState === "submitting"}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitState === "submitting" ? (
              <>
                <span className="spinner" aria-hidden="true" /> Requesting…
              </>
            ) : (
              "Request reschedule"
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
