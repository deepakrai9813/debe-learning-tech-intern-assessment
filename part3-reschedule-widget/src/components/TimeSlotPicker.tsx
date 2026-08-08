"use client";

import {
  isWithinLeadTime,
  localDateAndHourToUtc,
  toLocalDateInputValue,
} from "@/lib/time";

/** Hourly slot grid, in the parent's LOCAL wall-clock time. */
const SLOT_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] as const;

interface TimeSlotPickerProps {
  /** "YYYY-MM-DD" in local wall-clock terms (the `<input type="date">` value). */
  date: string;
  onDateChange: (date: string) => void;
  /** Locally-selected hour (0-23), or null when nothing is selected. */
  selectedHour: number | null;
  onSelectHour: (hour: number | null) => void;
  /** The session's current slot (UTC ISO) — the exact same instant is disabled. */
  currentSlotUtc: string;
}

export function TimeSlotPicker({
  date,
  onDateChange,
  selectedHour,
  onSelectHour,
  currentSlotUtc,
}: TimeSlotPickerProps) {
  // The earliest pickable date is LOCAL today; the 2-hour lockout and past-slot
  // disabling are handled per-slot below against real wall-clock time.
  const minDate = toLocalDateInputValue(new Date());

  return (
    <div className="slot-picker">
      <div className="slot-picker__row">
        <label className="field">
          <span className="field__label">Date</span>
          <input
            type="date"
            value={date}
            min={minDate}
            onChange={(e) => {
              onDateChange(e.target.value);
              onSelectHour(null);
            }}
          />
        </label>
        <p className="slot-picker__hint">
          Slots shown in your local time ({Intl.DateTimeFormat().resolvedOptions().timeZone ||
            "UTC"}
          ). Greyed slots are past or within 2 hours of now. Requests must be within 30
          days of today.
        </p>
      </div>

      <div className="slot-picker__grid" role="group" aria-label="Available times">
        {SLOT_HOURS.map((hour) => {
          // Build the UTC instant this LOCAL wall-clock slot would become.
          // localDateAndHourToUtc uses a local-time Date constructor + toISOString(),
          // so DST transitions are handled by the engine (see src/lib/time.ts).
          const slotUtc = localDateAndHourToUtc(date, hour);

          const withinLeadTime = isWithinLeadTime(slotUtc);
          const isCurrentSlot =
            Math.abs(new Date(slotUtc).getTime() - new Date(currentSlotUtc).getTime()) <
            60_000;

          const disabled = withinLeadTime || isCurrentSlot;
          const title = isCurrentSlot
            ? "This is the session's current time"
            : "Within 2 hours of now — not available (lead-time policy)";

          const selected = selectedHour === hour;
          const label = `${String(hour).padStart(2, "0")}:00`;

          return (
            <button
              key={hour}
              type="button"
              className={[
                "slot",
                selected ? "slot--selected" : "",
                disabled ? "slot--disabled" : "",
              ].join(" ")}
              disabled={disabled}
              aria-pressed={selected}
              title={disabled ? title : undefined}
              onClick={() => onSelectHour(hour)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
