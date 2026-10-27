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
