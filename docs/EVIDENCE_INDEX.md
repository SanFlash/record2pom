# Generated Evidence Index

**Creator attribution:** Satyendra Kumar Namdeo

Every generated project's `run_tests.py` writes `reports/evidence-index.json` after the run finishes.

## What is recorded

Each indexed artifact contains:

- `path`: normalized POSIX path relative to the generated project root.
- `category`: `report` or `screenshot`.
- `mediaType`: best-effort MIME type inferred from the filename.
- `sizeBytes`: byte length when indexed.
- `sha256`: SHA-256 digest of the artifact bytes.

The top-level object includes a schema version, generation timestamp, project name, run status, integrity metadata, artifact count, and artifact entries. The manifest intentionally does not include a hash of itself because that would be recursive.

## Verify the evidence locally

From the generated project root, run:

```bash
python -c "import hashlib,json,pathlib; m=json.loads(pathlib.Path('reports/evidence-index.json').read_text()); errors=[]; [(errors.append(x['path']) if not pathlib.Path(x['path']).is_file() or pathlib.Path(x['path']).stat().st_size != x['sizeBytes'] or hashlib.sha256(pathlib.Path(x['path']).read_bytes()).hexdigest() != x['sha256'] else None) for x in m['artifacts']); print('Evidence verification: ' + ('FAILED: ' + ', '.join(errors) if errors else 'PASSED')); raise SystemExit(bool(errors))"
```

A passing check means the indexed files match the recorded sizes and hashes. It does **not** prove who created the files, that the browser was trustworthy, or that the test assertions were correct. For stronger chain-of-custody guarantees, store the index and evidence in a separately controlled, append-only location.

## Safety and privacy

- Evidence is generated locally by the generated runner.
- Screenshots may contain personal, confidential, or authentication-related information. Review and redact them before sharing.
- SHA-256 detects content changes relative to the index; it is not a digital signature.
- The index excludes itself from its artifact list and does not alter the recorded journey or automatically repair tests.
- The runner only indexes files inside the generated project's reports directory and emits project-relative paths.

