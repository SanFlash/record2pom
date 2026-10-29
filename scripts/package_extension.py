#!/usr/bin/env python3
"""Build a deterministic, verified Chrome extension ZIP and SHA-256 sidecar."""
from __future__ import annotations

import hashlib
import json
import re
import stat
import sys
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
EXTENSION = ROOT / "extension"
DIST = ROOT / "dist"
VERSION_PATTERN = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$")
SENSITIVE_PATH_PARTS = {"..", ""}
FIXED_ZIP_TIME = (1980, 1, 1, 0, 0, 0)


def fail(message: str) -> None:
    raise SystemExit(f"Extension packaging failed: {message}")


def safe_archive_name(path: Path) -> str:
    name = path.relative_to(EXTENSION).as_posix()
    parsed = PurePosixPath(name)
    if parsed.is_absolute() or any(part in SENSITIVE_PATH_PARTS for part in parsed.parts):
        fail(f"unsafe archive path: {name}")
    return name


def validate_manifest() -> tuple[dict, list[Path]]:
    manifest_path = EXTENSION / "manifest.json"
    if not manifest_path.is_file():
        fail("extension/manifest.json is missing")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        fail(f"manifest is not valid JSON: {error}")
    if manifest.get("manifest_version") != 3:
        fail("manifest_version must be 3")
    version = manifest.get("version", "")
    if not VERSION_PATTERN.fullmatch(version):
        fail(f"manifest version is not a valid numeric release version: {version!r}")
    if "Record2POM" not in manifest.get("name", ""):
        fail("manifest name must identify Record2POM")

    referenced = {
        "manifest.json",
        manifest.get("background", {}).get("service_worker", ""),
        manifest.get("action", {}).get("default_popup", ""),
        "popup.css",
    }
    referenced.update(manifest.get("icons", {}).values())
    referenced.update(manifest.get("action", {}).get("default_icon", {}).values())
    for script in manifest.get("content_scripts", []):
        referenced.update(script.get("js", []))
        referenced.update(script.get("css", []))
    referenced.discard("")
    for relative in referenced:
        candidate = EXTENSION / relative
        if not candidate.is_file() or candidate.resolve().parent != EXTENSION.resolve() and EXTENSION.resolve() not in candidate.resolve().parents:
            fail(f"manifest references missing or out-of-root asset: {relative}")
    return manifest, sorted(referenced)


def main() -> None:
    if not EXTENSION.is_dir():
        fail("extension directory is missing")
    manifest, required = validate_manifest()
    files = sorted(path for path in EXTENSION.rglob("*") if path.is_file())
    if not files:
        fail("extension directory is empty")
    for path in files:
        if path.is_symlink():
            fail(f"symbolic links are not packaged: {path}")
        safe_archive_name(path)
    included = {safe_archive_name(path) for path in files}
    missing = set(required) - included
    if missing:
        fail("required extension assets missing from archive set: " + ", ".join(sorted(missing)))

    DIST.mkdir(parents=True, exist_ok=True)
    version = manifest["version"]
    archive = DIST / f"record2pom-extension-v{version}.zip"
    checksum = archive.with_suffix(archive.suffix + ".sha256")
    if archive.exists():
        archive.unlink()
    if checksum.exists():
        checksum.unlink()

    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zipped:
        for path in files:
            name = safe_archive_name(path)
            info = zipfile.ZipInfo(name, date_time=FIXED_ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            zipped.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)

    with zipfile.ZipFile(archive, "r") as zipped:
        bad_member = zipped.testzip()
        if bad_member:
            fail(f"ZIP CRC validation failed for {bad_member}")
        names = zipped.namelist()
        if len(names) != len(set(names)):
            fail("archive contains duplicate paths")
        for name in names:
            safe = PurePosixPath(name)
            if safe.is_absolute() or any(part in SENSITIVE_PATH_PARTS for part in safe.parts):
                fail(f"unsafe path in generated archive: {name}")
        missing_from_zip = included - set(names)
        unexpected = set(names) - included
        if missing_from_zip or unexpected:
            fail(f"archive membership mismatch; missing={sorted(missing_from_zip)}, unexpected={sorted(unexpected)}")
        packaged_manifest = json.loads(zipped.read("manifest.json").decode("utf-8"))
        if packaged_manifest.get("version") != version:
            fail("packaged manifest version differs from source manifest")

    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    checksum.write_text(f"{digest}  {archive.name}\n", encoding="ascii")
    verified_digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    recorded_digest = checksum.read_text(encoding="ascii").split()[0]
    if digest != verified_digest or digest != recorded_digest:
        fail("SHA-256 sidecar verification failed")

    print(f"Validated Chrome extension v{version}")
    print(f"Archive:  {archive.relative_to(ROOT).as_posix()} ({archive.stat().st_size} bytes)")
    print(f"SHA-256:  {digest}")
    print(f"Checksum: {checksum.relative_to(ROOT).as_posix()}")
    print(f"Files:    {len(files)} verified; ZIP CRC and membership checks passed")


if __name__ == "__main__":
    main()
