from pathlib import Path
from playwright.sync_api import Page, expect

SHOWCASE = Path(__file__).resolve().parents[2] / "showcase" / "index.html"


def test_motion_lab_renders_core_content_and_links(page: Page) -> None:
    page.goto(SHOWCASE.as_uri(), wait_until="domcontentloaded")

    expect(page.get_by_role("heading", level=1)).to_contain_text("Capture the flow.")
    expect(page.get_by_role("heading", level=1)).to_contain_text("Generate the future.")
    expect(page.locator("#stage")).to_be_visible()
    expect(page.locator(".float-card")).to_have_count(4)
    expect(page.get_by_role("link", name="Launch Record2POM")).to_have_attribute(
        "href", "https://record2pom.vercel.app/"
    )
    expect(page.get_by_role("link", name="Explore the source")).to_have_attribute(
        "href", "https://github.com/SanFlash/record2pom"
    )


def test_motion_lab_layout_fits_mobile_viewport(page: Page) -> None:
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(SHOWCASE.as_uri(), wait_until="domcontentloaded")

    expect(page.locator("#stage")).to_be_visible()
    expect(page.get_by_role("link", name="OPEN STUDIO ↗")).to_be_visible()
    expect(page.locator("#capabilities")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
