# Debe Learning — Tech Intern Assessment

Role: **Tech Intern (Web/Portal Engineering)** · Stack: React / Next.js, Firebase Cloud Functions, Node.js + TypeScript

This repository contains my submission for all four parts of the assessment. Written answers live in [`SUBMISSION.md`](./SUBMISSION.md).

## Repository structure

```
.
├── SUBMISSION.md                     # Written answers — Part 1 (portfolio), Part 2 summary, Part 4 talking points
├── part2-debug/
│   ├── original.ts                   # The Cloud Function as provided, with 4 bugs (verbatim copy)
│   └── fixed.ts                      # Fixed version — each fix annotated with a comment above it
└── part3-reschedule-widget/          # Next.js (App Router) app — "Session Reschedule Widget"
    └── src/
        ├── app/                      # App Router: layout, page, global styles
        ├── components/               # Widget, session cards, reschedule form, time-slot picker
        ├── lib/                      # Mock data, mock `requestReschedule` Cloud Function, time utilities
        └── shared/                   # Shared TypeScript types (frontend ↔ function) — no `any`
```

## Part 3 — Session Reschedule Widget

A parent-facing widget that shows the next 3 upcoming tutoring sessions and lets the parent
request a reschedule. Built with **Next.js App Router + TypeScript**, with the Cloud Function
mocked locally (same signature, same validation, same shared types as the real deployment).

### Run it

```bash
cd part3-reschedule-widget
npm install
npm run dev        # http://localhost:3000
```

### Verify it

The widget ships with a Playwright smoke test that exercises the full flow — cards
render, the modal opens, the 2-hour lockout disables slots, local display + UTC
storage are visible, the happy path succeeds, and a server-side rejection surfaces
as a typed error:

```bash
python -m pip install playwright && python -m playwright install chromium
python scripts/smoke_test.py --base-url http://localhost:3000
```

### Key design decisions (see code comments for the full reasoning)

- **UTC storage, local display** — session datetimes are stored as UTC ISO-8601 strings.
  The UI renders them in the parent's local timezone and the form builds the new slot from
  local wall-clock time, converting to UTC on submit.
- **2-hour lead-time lockout** — time slots within 2 hours of "now" are disabled in the picker
  (real tutoring lead-time policy). The mocked Cloud Function re-validates it server-side as
  defense-in-depth.
- **Typed end-to-end** — `src/shared/types.ts` is imported by both the UI and the mock function.
  No `any` anywhere.
