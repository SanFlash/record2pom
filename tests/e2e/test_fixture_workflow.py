from pathlib import Path
from playwright.sync_api import Page, expect

FIXTURE = Path(__file__).resolve().parents[2] / "fixtures" / "universal-demo" / "index.html"

def test_fixture_supports_semantic_form_journey(page: Page) -> None:
    html = FIXTURE.read_text(encoding="utf-8")
    page.set_content(html)

    expect(page.get_by_role("heading", name="Universal recording fixture")).to_be_visible()
    expect(page.get_by_test_id("submit-form")).to_have_count(1)
    expect(page.get_by_role("button", name="Submit form")).to_have_count(1)

    page.get_by_label("Full name").fill("Fixture User")
    page.get_by_label("Country").select_option(label="India")
    page.get_by_label("Send updates").check()
    page.get_by_label("Notes").fill("Recorded journey smoke test")
    page.get_by_role("tab", name="Details").click()

    expect(page.get_by_role("status")).to_be_visible()
    expect(page.locator("#result")).to_have_text("Details selected")

    page.get_by_test_id("submit-form").click()
    expect(page.locator("#result")).to_have_text("Submitted: Fixture User")
    expect(page.get_by_label("Send updates")).to_be_checked()
    expect(page.get_by_label("Country")).to_have_value("in")
