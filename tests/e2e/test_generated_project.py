from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import time
import zipfile
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import Page, expect

ROOT = Path(__file__).resolve().parents[2]
FIXTURE_PATH = "/fixtures/universal-demo/index.html"


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _wait_for_server(url: str, process: subprocess.Popen[str]) -> None:
    deadline = time.monotonic() + 15
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise AssertionError(f"Static server exited early with code {process.returncode}")
        try:
            with urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except Exception as exc:  # server may need a moment to bind
            last_error = exc
        time.sleep(0.1)
    raise AssertionError(f"Static server did not become ready: {last_error}")


def test_dashboard_generates_and_executes_real_playwright_project(page: Page, tmp_path: Path) -> None:
    """Exercise dashboard import -> generation -> ZIP -> actual generated pytest execution."""
    port = _free_port()
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    base = f"http://127.0.0.1:{port}"
    fixture_url = base + FIXTURE_PATH
    try:
        _wait_for_server(base + "/index.html", server)
        page.goto(base + "/index.html")
        page.get_by_label("Project name").fill("generated-fixture-e2e")
        page.get_by_label("Target URL").fill(fixture_url)

        recording = {
            "schemaVersion": 1,
            "targetUrl": fixture_url,
            "events": [
                {
                    "id": "generated-fill-name",
                    "sequence": 1,
                    "kind": "fill",
                    "description": "Enter the generated test user's name",
                    "target": {"label": "Full name"},
                    "locators": [
                        {"strategy": "label", "value": "Full name", "matchCount": 1}
                    ],
                    "value": "Generated User",
                    "source": "e2e-fixture",
                },
                {
                    "id": "generated-submit-form",
                    "sequence": 2,
                    "kind": "click",
                    "description": "Submit the fixture form",
                    "target": {"testId": "submit-form"},
                    "locators": [
                        {"strategy": "testId", "value": "submit-form", "matchCount": 1}
                    ],
                    "source": "e2e-fixture",
                },
                {
                    "id": "generated-assert-result",
                    "sequence": 3,
                    "kind": "assert-text",
                    "description": "Verify the submitted name appears",
                    "value": "Submitted: Generated User",
                    "assertion": {"expected": "Submitted: Generated User"},
                    "source": "e2e-fixture",
                },
            ],
        }
        recording_file = tmp_path / "recording.json"
        recording_file.write_text(json.dumps(recording), encoding="utf-8")
        page.locator("#file").set_input_files(str(recording_file))
        expect(page.locator("#count")).to_have_text("3")
        expect(page.locator("#status")).to_contain_text("Imported 3 event(s)")

        page.get_by_role("button", name="Generate project").click()
        expect(page.locator("#status")).to_contain_text("tests have NOT been executed")
        expect(page.locator("#files")).to_contain_text("pages/recorded_page.py")

        with page.expect_download() as download_info:
            page.get_by_role("button", name="Download ZIP").click()
        download = download_info.value
        archive_path = tmp_path / "generated-project.zip"
        download.save_as(archive_path)

        project_dir = tmp_path / "generated-project"
        project_dir.mkdir()
        with zipfile.ZipFile(archive_path) as archive:
            bad_member = next(
                (
                    name
                    for name in archive.namelist()
                    if Path(name).is_absolute() or ".." in Path(name).parts
                ),
                None,
            )
            assert bad_member is None, f"Unexpected unsafe ZIP member: {bad_member}"
            archive.extractall(project_dir)

        assert (project_dir / "pages" / "recorded_page.py").is_file()
        assert (project_dir / "tests" / "test_recorded_journey.py").is_file()
        env = os.environ.copy()
        env["BASE_URL"] = fixture_url
        run = subprocess.run(
            [sys.executable, "-m", "pytest", "-q", "tests"],
            cwd=project_dir,
            env=env,
            text=True,
            capture_output=True,
            timeout=90,
            check=False,
        )
        assert run.returncode == 0, (
            "Generated Playwright project failed to execute.\n"
            f"stdout:\n{run.stdout}\nstderr:\n{run.stderr}"
        )
        assert "1 passed" in run.stdout, run.stdout
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=5)



def test_dashboard_generates_and_preflights_real_selenium_project(page: Page, tmp_path: Path) -> None:
    """Validate the Selenium ZIP contents and generated Python files without claiming browser execution."""
    port = _free_port()
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    base = f"http://127.0.0.1:{port}"
    fixture_url = base + FIXTURE_PATH
    try:
        _wait_for_server(base + "/index.html", server)
        page.goto(base + "/index.html")
        page.get_by_label("Project name").fill("selenium-generated-fixture")
        page.get_by_label("Target URL").fill(fixture_url)
        page.get_by_label("Engine").select_option("selenium")
        expect(page.get_by_label("Test framework")).to_have_value("unittest")

        recording = {
            "schemaVersion": 1,
            "targetUrl": fixture_url,
            "events": [
                {
                    "id": "selenium-fixture-click",
                    "sequence": 1,
                    "kind": "click",
                    "description": "Submit the fixture form",
                    "target": {"testId": "submit-form"},
                    "locators": [
                        {"strategy": "testId", "value": "submit-form", "matchCount": 1}
                    ],
                    "source": "selenium-e2e-fixture",
                }
            ],
        }
        recording_file = tmp_path / "selenium-recording.json"
        recording_file.write_text(json.dumps(recording), encoding="utf-8")
        page.locator("#file").set_input_files(str(recording_file))
        expect(page.locator("#count")).to_have_text("1")
        page.get_by_role("button", name="Generate project").click()
        expect(page.locator("#files")).to_contain_text("validate_project.py")
        expect(page.locator("#files")).to_contain_text("pages/recorded_page.py")

        with page.expect_download() as download_info:
            page.get_by_role("button", name="Download ZIP").click()
        archive_path = tmp_path / "selenium-generated-project.zip"
        download_info.value.save_as(archive_path)

        project_dir = tmp_path / "selenium-project"
        project_dir.mkdir()
        with zipfile.ZipFile(archive_path) as archive:
            names = archive.namelist()
            bad_member = next(
                (name for name in names if Path(name).is_absolute() or ".." in Path(name).parts),
                None,
            )
            assert bad_member is None, f"Unexpected unsafe ZIP member: {bad_member}"
            assert len(names) == len(set(names)), "ZIP must not contain duplicate paths"
            assert "pages/recorded_page.py" in names
            assert "tests/test_recorded_journey.py" in names
            assert "validate_project.py" in names
            archive.extractall(project_dir)

        validation = subprocess.run(
            [sys.executable, "validate_project.py"],
            cwd=project_dir,
            text=True,
            capture_output=True,
            timeout=20,
            check=False,
        )
        assert validation.returncode == 0, (
            "Generated Selenium project preflight failed.\\n"
            f"stdout:\\n{validation.stdout}\\nstderr:\\n{validation.stderr}"
        )
        assert "preflight PASSED" in validation.stdout
        compile_check = subprocess.run(
            [
                sys.executable,
                "-c",
                "import ast; from pathlib import Path; "
                "files=['config.py','pages/recorded_page.py',"
                "'tests/test_recorded_journey.py','run_tests.py']; "
                "[ast.parse(Path(p).read_text(encoding='utf-8'), filename=p) for p in files]; "
                "print('All generated Selenium Python modules parsed.')",
            ],
            cwd=project_dir,
            text=True,
            capture_output=True,
            timeout=20,
            check=False,
        )
        assert compile_check.returncode == 0, compile_check.stderr
        assert "All generated Selenium Python modules parsed." in compile_check.stdout
        assert (project_dir / "data" / "recorded_test_data.json").is_file()
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=5)



def test_generated_playwright_project_handles_dynamic_tabs_and_complete_form_journey(
    page: Page, tmp_path: Path
) -> None:
    """Run a multi-step journey covering a dynamic tab, native controls and post-submit state."""
    port = _free_port()
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    base = f"http://127.0.0.1:{port}"
    fixture_url = base + FIXTURE_PATH
    try:
        _wait_for_server(base + "/index.html", server)
        page.goto(base + "/index.html")
        page.get_by_label("Project name").fill("dynamic-form-journey")
        page.get_by_label("Target URL").fill(fixture_url)
        recording = {
            "schemaVersion": 1,
            "targetUrl": fixture_url,
            "events": [
                {
                    "id": "journey-details-tab", "sequence": 1, "kind": "click",
                    "description": "Open dynamic details tab",
                    "target": {"testId": "details-tab"},
                    "locators": [{"strategy": "testId", "value": "details-tab", "matchCount": 1}],
                },
                {
                    "id": "journey-tab-assertion", "sequence": 2, "kind": "assert-text",
                    "description": "Verify dynamic tab outcome",
                    "value": "Details selected", "assertion": {"expected": "Details selected"},
                },
                {
                    "id": "journey-fill-name", "sequence": 3, "kind": "fill",
                    "description": "Enter form name", "target": {"label": "Full name"},
                    "locators": [{"strategy": "label", "value": "Full name", "matchCount": 1}],
                    "value": "Journey User",
                },
                {
                    "id": "journey-select-country", "sequence": 4, "kind": "select",
                    "description": "Choose country", "target": {"label": "Country"},
                    "locators": [{"strategy": "label", "value": "Country", "matchCount": 1}],
                    "value": "India",
                },
                {
                    "id": "journey-check-updates", "sequence": 5, "kind": "check",
                    "description": "Enable updates", "target": {"label": "Send updates"},
                    "locators": [{"strategy": "label", "value": "Send updates", "matchCount": 1}],
                },
                {
                    "id": "journey-fill-notes", "sequence": 6, "kind": "fill",
                    "description": "Enter optional notes", "target": {"label": "Notes"},
                    "locators": [{"strategy": "label", "value": "Notes", "matchCount": 1}],
                    "value": "Generated journey completed",
                },
                {
                    "id": "journey-submit", "sequence": 7, "kind": "click",
                    "description": "Submit completed form", "target": {"testId": "submit-form"},
                    "locators": [{"strategy": "testId", "value": "submit-form", "matchCount": 1}],
                },
                {
                    "id": "journey-submit-assertion", "sequence": 8, "kind": "assert-text",
                    "description": "Verify submitted form output",
                    "value": "Submitted: Journey User",
                    "assertion": {"expected": "Submitted: Journey User"},
                },
            ],
        }
        recording_file = tmp_path / "dynamic-journey.json"
        recording_file.write_text(json.dumps(recording), encoding="utf-8")
        page.locator("#file").set_input_files(str(recording_file))
        expect(page.locator("#count")).to_have_text("8")
        page.get_by_role("button", name="Generate project").click()
        with page.expect_download() as download_info:
            page.get_by_role("button", name="Download ZIP").click()
        archive_path = tmp_path / "dynamic-journey.zip"
        download_info.value.save_as(archive_path)
        project_dir = tmp_path / "dynamic-journey"
        project_dir.mkdir()
        with zipfile.ZipFile(archive_path) as archive:
            assert len(archive.namelist()) == len(set(archive.namelist()))
            assert all(not Path(name).is_absolute() and ".." not in Path(name).parts for name in archive.namelist())
            archive.extractall(project_dir)
        env = os.environ.copy()
        env["BASE_URL"] = fixture_url
        run = subprocess.run(
            [sys.executable, "-m", "pytest", "-q", "tests"],
            cwd=project_dir, env=env, text=True, capture_output=True, timeout=90, check=False,
        )
        assert run.returncode == 0, (
            "Generated dynamic journey failed.\n"
            f"stdout:\n{run.stdout}\nstderr:\n{run.stderr}"
        )
        assert "1 passed" in run.stdout, run.stdout
        data = json.loads((project_dir / "data" / "recorded_test_data.json").read_text(encoding="utf-8"))
        assert len(data["steps"]) == 8
        assert [step["kind"] for step in data["steps"]] == [
            "click", "assert-text", "fill", "select", "check", "fill", "click", "assert-text"
        ]
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=5)
