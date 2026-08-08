"""Smoke test for the Session Reschedule Widget.

Run against a running dev server (default http://127.0.0.1:3000):

    python -m pip install playwright && python -m playwright install chromium
    python scripts/smoke_test.py --base-url http://127.0.0.1:3000

Exit code 0 = all checks passed. Screenshots are saved to /tmp/widget_*.png.
"""

import argparse
import datetime
import sys
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

OUT_DIR = Path("/tmp")


def local_date(days_from_now: int) -> str:
    return (datetime.date.today() + datetime.timedelta(days=days_from_now)).isoformat()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:3000")
    parser.add_argument("--headful", action="store_true", help="Run with a visible browser")
    args = parser.parse_args()

    failures: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headful)
        page = browser.new_page(viewport={"width": 900, "height": 1200})

        console_errors: list[str] = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))

        page.goto(args.base_url, wait_until="networkidle")

        # ── 1. Three session cards with all four required fields ─────────────
        cards = page.locator(".session-card")
        expect(cards).to_have_count(3)
        for i in range(3):
            card = cards.nth(i)
            expect(card.locator(".session-card__subject")).not_to_be_empty()
            expect(card.locator(".session-card__teacher")).not_to_be_empty()
            expect(card.locator(".session-card__time")).not_to_be_empty()
            expect(card.locator(".badge")).not_to_be_empty()
            expect(card.locator(".btn--outline")).to_have_text("Request reschedule")
        page.screenshot(path=OUT_DIR / "widget_list.png", full_page=True)
        print("PASS: 3 session cards render with subject/teacher/datetime/status")

        # ── 2. Open the reschedule modal on the first session ────────────────
        cards.nth(0).locator(".btn--outline").click()
        modal = page.locator(".modal")
        expect(modal).to_be_visible()
        expect(modal.locator("#reschedule-title")).to_have_text("Request a reschedule")
        page.screenshot(path=OUT_DIR / "widget_modal.png")
        print("PASS: modal opens with reschedule form")

        # ── 3. Slot grid: 12 slots; today's date disables past/within-2h slots ──
        slots = modal.locator(".slot")
        expect(slots).to_have_count(12)
        # The 2-hour lead-time lockout is time-of-day dependent, so assert it on
        # TODAY's date, where the earlier hours are always past/within lead time.
        modal.locator('input[type="date"]').fill(local_date(0))
        expect(modal.locator(".slot--disabled").first).to_be_visible()
        print("PASS: 12 time slots render; today shows disabled slots (2h lockout/past)")

        # ── 3b. Regression: clearing the date input must not crash the picker ──
        modal.locator('input[type="date"]').fill("")
        expect(modal.locator(".slot-picker__empty")).to_be_visible()
        expect(page.locator(".modal")).to_be_visible()  # still alive, no crash
        print("PASS: clearing the date field shows a hint instead of crashing")

        # ── 4. Reason dropdown offers the four required options ──────────────
        options = modal.locator("select option").all_inner_texts()
        for expected in ["Conflict", "Illness", "Time zone", "Other"]:
            assert expected in options, f"missing reason option {expected}"
        print("PASS: reason dropdown has Conflict / Illness / Time zone / Other")

        # ── 5. Pick a slot on a future date → local display + UTC storage visible ──
        tomorrow = local_date(1)
        modal.locator('input[type="date"]').fill(tomorrow)
        modal.locator(".slot:not(.slot--disabled)").first.click()
        expect(modal.locator(".slot-summary__local")).not_to_be_empty()
        utc_text = modal.locator(".slot-summary__utc").inner_text()
        assert utc_text.startswith("Stored & sent as UTC:") and utc_text.rstrip().endswith("Z"), utc_text
        print(f"PASS: slot preview shows local time + UTC storage ({utc_text.strip()[:60]}…)")

        # ── 6. Happy path: submit → loading state → success notice + card update ──
        modal.locator("select").select_option(label="Conflict")
        modal.locator(".btn--primary").click()
        page.wait_for_timeout(120)  # capture the brief loading state
        assert "Requesting" in modal.locator(".btn--primary").inner_text() or not modal.locator(
            ".btn--primary"
        ).is_enabled()
        print("PASS: submit shows a loading state")
        expect(page.locator(".notice")).to_be_visible(timeout=8000)
        expect(page.locator(".notice")).to_contain_text("Reschedule requested")
        expect(page.locator(".modal")).to_have_count(0)  # modal closed
        page.screenshot(path=OUT_DIR / "widget_success.png")
        print("PASS: success banner shown, modal closed")

        # ── 7. Error path: date beyond the 30-day advance-notice window ──────
        cards.nth(1).locator(".btn--outline").click()
        modal = page.locator(".modal")
        expect(modal).to_be_visible()
        modal.locator('input[type="date"]').fill(local_date(45))
        modal.locator(".slot:not(.slot--disabled)").first.click()
        modal.locator("select").select_option(label="Illness")
        modal.locator(".btn--primary").click()
        expect(modal.locator(".form-error")).to_be_visible(timeout=8000)
        expect(modal.locator(".form-error")).to_contain_text("30 days")
        page.screenshot(path=OUT_DIR / "widget_error.png")
        print("PASS: server-side rejection surfaces as a typed error in the form")

        browser.close()

    if console_errors:
        failures.append(f"console/page errors: {console_errors[:5]}")

    if failures:
        print("\nFAILURES:", *failures, sep="\n - ")
        return 1
    print("\nALL CHECKS PASSED ✔")
    return 0


if __name__ == "__main__":
    sys.exit(main())
