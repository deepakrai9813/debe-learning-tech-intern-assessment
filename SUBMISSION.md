# SUBMISSION — Debe Learning Tech Intern Assessment

Role: **Tech Intern (Web/Portal Engineering)**

---

## Part 1 — GitHub Portfolio Walkthrough

### 1. GitHub profile

- **Profile:** https://github.com/deepakrai9813

### 2. Repositories

> ⚠️ These answers are drafted from the repo structure and should be re-worded in your own
> voice and verified against your actual work before submitting — especially "what I built".

#### Repo A: [SajhaEduCore](https://github.com/deepakrai9813/SajhaEduCore)

- **Problem it solves:** An ed-tech platform backend ("Sajha Edu" — shared education) that
  keeps the domain — courses, batches, branches and their relationships — organized as
  modular Django apps instead of one monolithic models file, so new modules can be added
  without entangling existing ones.
- **What I built:** The core backend structure: modular Django apps per domain area with
  models, admins, and a DRF-style API layer for each (URLs, filters, permissions,
  throttles), plus a domain-driven design note (`DDDArchitecture.txt`) that documents how
  the modules split responsibilities. *(Confirm this matches what you owned, and add any
  specific endpoints/models you implemented.)*
- **One design decision I'd change today:** The project grew mostly server-side; if I were
  starting over I'd pair each domain module with its own test suite and a CI pipeline from
  day one (and maybe a service/repository layer to keep views thin), so the modularity
  doesn't outrun the test coverage that protects it.

#### Repo B: [Portfolio](https://github.com/deepakrai9813/Portfolio)

- **Problem it solves:** A personal portfolio site — a single landing experience that
  presents who I am and what I build, with SEO basics (sitemap, robots.txt, Google site
  verification) so the site is findable and indexable.
- **What I built:** The React (Vite) front end: the app shell, main page component, and
  styling, plus the static SEO assets (sitemap, robots, verification file). *(Confirm the
  scope and re-word in your voice.)*
- **One design decision I'd change today:** It's a client-side React SPA, so the initial
  render depends on JavaScript. I'd rebuild it on Next.js to get server-rendered HTML for
  faster first paint and better SEO, and to exercise the same App Router + React patterns
  I use in this assessment.

*Both repos are genuinely built by me — no trivial forks. SajhaEduCore has 22 commits and
Portfolio has 8, committed incrementally over time rather than squashed into one.*

---

## Part 2 — Debugging Round

The original function is preserved verbatim in [`part2-debug/original.ts`](./part2-debug/original.ts);
the fixed version is in [`part2-debug/fixed.ts`](./part2-debug/fixed.ts), with each fix annotated
by a comment directly above it. Summary of the four bugs found:

| # | Category | Bug | Production impact |
|---|----------|-----|-------------------|
| 1 | **Security** | `context.auth` is never checked; caller identity never verified | Unauthenticated callers can create bookings for any student/teacher — auth bypass, spam/DoS, forged calendar blocks, billed writes |
| 2 | **Async/await** | `.get()` is not awaited; `.add()` is a floating promise | `existing.docs` crashes at runtime; the function can return `success: true` before the write lands — bookings silently lost when the container is terminated |
| 3 | **Logic** | Double-booking check queries `teachers/{id}/bookings` but the write goes to the top-level `bookings` collection; also a check-then-insert race | The conflict check can never detect a real conflict (different location), and two concurrent requests can both pass the check — double-booked slots |
| 4 | **Typing** | No return type; mixed sync/async returns; `data` untyped and possibly `undefined` | No contract for callers, un-trackable floating promises, `TypeError` on missing payload instead of a clean client error |

**Fix strategy:** authenticate + authorize inside the callable → `await` the query → validate the
slot is a real future date → move the check and write into a single `runTransaction` operating on
the *same* collection path → type the handler as `async (...): Promise<BookingResult>` with an
explicit shared result interface.

---

## Part 3 — Build Task: Session Reschedule Widget

Built in `part3-reschedule-widget/` — Next.js (App Router) + TypeScript, no `any`.

**Run it:** `cd part3-reschedule-widget && npm install && npm run dev` → http://localhost:3000

### What was built

- **Parent-facing widget** listing the student's next 3 upcoming sessions (mocked static data)
  with `subject`, `teacherName`, `datetime`, `status`.
- **"Request Reschedule"** on each session opens a form: date picker + time-slot grid + reason
  dropdown (Conflict / Illness / Time zone / Other).
- **Submit calls the `requestReschedule` Cloud Function** — mocked locally (same signature, same
  validation, same shared types as a deployed function). It validates that the new slot is not in
  the past, is not identical to the current slot, and is not within the 2-hour lockout, and
  returns a typed `{ success: boolean; error?: string }`.
- **Loading and error states** everywhere — no unhandled promise rejections.
- **Commit history** is incremental: scaffold → shared types/validation → UI → styling/polish.

### The two "must-be-reasoned-about" details

**UTC storage, local display.** All session datetimes are stored as UTC ISO-8601 strings
(`...Z`) in the mock data. The UI renders them through `Intl.DateTimeFormat` in the parent's
browser timezone, and the form is labeled with the detected timezone (e.g. `UTC+5:30`). The form
builds the new slot from local wall-clock parts (`new Date(y, m-1, d, h, min)` — a local-time
constructor) and converts to UTC with `.toISOString()` before calling the function, so what the
function receives is unambiguous UTC. This means the same stored value renders correctly for a
parent in any timezone, and the backend never has to guess "whose local time?". Full reasoning in
comments in [`src/lib/time.ts`](./part3-reschedule-widget/src/lib/time.ts) and
[`src/lib/requestReschedule.ts`](./part3-reschedule-widget/src/lib/requestReschedule.ts).

**2-hour lead-time lockout.** Tutoring sessions require at least 2 hours' notice, so the picker
disables any time slot whose UTC instant is within 2 hours of `Date.now()` (all slots in the past
are disabled too, via a `min` date). The disabled slots are visually muted with an explanatory
label. The lockout is computed from *real* wall-clock time — not from the mocked data — so it
always reflects "now". Defense in depth: the mock Cloud Function re-validates the 2-hour rule
server-side, because a client-side-only rule can be bypassed with a direct call.

### What I'd change with more time

- Connect the mock function to a real Firebase project (emulator locally) to exercise the full
  Cloud Functions path.
- Sync the parent's timezone preference with their profile rather than always using the browser
  timezone.
- Add tests for the time utilities (DST edge cases) and the function's validation.

---

## Part 4 — Explain-It-Yourself Video (script outline)

*Recorded as a 4–7 min unedited screen recording. Outline of what I walk through, live:*

1. **Walk through the Part 3 code** (no notes): start at `src/shared/types.ts` → the mock data →
   the widget component → the reschedule form → `src/lib/requestReschedule.ts` → the time utils.
   I explain each piece's job as I scroll, in my own words.
2. **Explain local-time/UTC + 2-hour lockout out loud:** why datetimes are stored as UTC ISO
   strings, how the form converts local wall-clock → UTC via a local-time `Date` constructor +
   `.toISOString()`, why display uses `Intl.DateTimeFormat`, and how the 2-hour lockout compares
   the chosen slot's UTC instant against `Date.now()`.
3. **Intentionally break something on camera:** comment out the `.toISOString()` conversion so a
   local wall-clock string is sent instead of UTC, then submit and show what breaks — the server
   treats it as a different instant, and (in a real deployment) a parent in another timezone would
   get the wrong slot. I explain exactly why.

---

*Prepared by: [TODO: your name]*
