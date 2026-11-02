# Record2POM feature parity and implementation plan

**Product owner / creator:** Satyendra Kumar Namdeo  
**Benchmark:** publicly documented BugBug product capabilities  
**Architecture target:** Chrome extension first, local-first test assets, generated runners

This is a capability map, not a claim that every item is already implemented. Features are marked complete only when code and regression coverage exist. Record2POM uses original implementations and does not copy BugBug source code, private APIs, branding or proprietary internals.

## Recording and test authoring

| Capability | Current state | Engineering target |
|---|---|---|
| Chrome MV3 side-panel recorder | Implemented | Keep recording controls available while browsing |
| Clicks, typing, form controls, URL navigation | Implemented | Preserve event order and test-data separation |
| First-click visibility assertion | Implemented | Add configurable assertion presets and multi-select assertion mode |
| Adaptive locator candidates | Implemented baseline | Add locator scoring, live uniqueness re-check, fallback chains and repair suggestions |
| Hover capture | In this branch | Explicit toggle, avoid duplicate hover noise |
| Scroll capture | In this branch | Debounced positions and scroll-into-view replay |
| Drag and drop | In this branch | Capture source and destination locators; support HTML5 and pointer-based widgets |
| Visual test editor | Partial — local step editor added | Edit action, description, value and CSS fallback; insert/reorder/duplicate/delete; live locator verification and advanced parameter forms remain open |
| Smart click and smart waiting | Partial | Visibility, enabled, stability, overlay and navigation waits with bounded retry |
| Tabs and popups | Not implemented | Track tab lifecycle and opener relationships |
| Iframes | Not implemented | Frame-aware event metadata and frame-scoped locator execution |
| Keyboard shortcuts and typing semantics | Partial | Key chords, text entry, select, file upload, clipboard-safe handling |
| Manual assertions | Partial | Text, URL, visibility, value, attributes, count, checked state, title and screenshot assertions |
| Add multiple assertions | Not implemented | Multi-select targets with explicit review before saving |

## Test organization and authoring power

| Capability | Current state | Engineering target |
|---|---|---|
| Named tests and suites | Implemented baseline — browser-local | Save/load/delete journeys; folders and suites are local-only; tags, search, filtering and cross-device sync remain open |
| Reusable components | Partial — reusable journey snapshots | Save and insert journey groups with remapped action IDs and input data keys; parameters, nested components and dependency validation remain open |
| Variables and environment profiles | Partial — browser-local profile editor | Create profiles and variables; secret references store no secret value; generated-runner injection, scope precedence and profile CLI selection remain open |
| Conditional logic | Not implemented | If/else, retry, loop and branch steps with bounded execution |
| Custom JavaScript | Not implemented | Explicit opt-in sandboxed test step with timeout and visible source |
| Email testing inbox | Not implemented | Provider adapter interface; never invent an inbox service |
| YAML import/export | Partial — YAML export and JSON backup/restore | Export workspace YAML and backup/restore JSON; YAML import, schema validation and round-trip tests remain open |
| Edit and rewind | Not implemented | Replay from selected checkpoint using saved state and step evidence |

## Execution, debugging and evidence

| Capability | Current state | Engineering target |
|---|---|---|
| Playwright and Selenium generation | Implemented baseline | Keep the same canonical test model for all supported languages |
| Python, JavaScript, TypeScript and Java outputs | Implemented baseline | Run generated projects in CI for each supported combination |
| Local execution | Generated project only | Extension-triggered local runner and CLI |
| Cloud execution | Not implemented | Optional authenticated runner service; static Vercel hosting is not an execution backend |
| Parallel execution | Not implemented | Worker pool, concurrency limits and isolated browser contexts |
| Schedules | Not implemented | Local scheduler first; cloud scheduler only with a backend |
| Step screenshots | Partial | Automatic per-step screenshot with secret redaction and retention controls |
| Debug and rewind | Not implemented | Pause, inspect, edit and resume from a selected checkpoint |
| Visual regression | Not implemented | Baseline approval, pixel threshold, masking and diff artifacts |
| Run history and flakiness analytics | Not implemented | Persistent local run store, trends, retries and reliability metrics |
| Reports | Partial | HTML, PDF, CSV, JSON, JUnit XML and evidence bundle |
| Smart failure diagnosis | Partial | Explain locator, wait, navigation, assertion and network failures separately |

## Integrations and collaboration

| Capability | Current state | Engineering target |
|---|---|---|
| GitHub Actions | CI for this repository | Reusable workflow for generated test projects |
| CLI and REST API | Not implemented | Local CLI and versioned local HTTP API; authenticated remote API later |
| Webhooks | Not implemented | Signed outgoing events and protected incoming run triggers |
| Slack / Jira / Linear | Not implemented | Optional connector adapters with explicit user authorization |
| Team comments and notes | Not implemented | Local annotations first; shared comments require a backend |
| Roles and permissions | Not implemented | Workspace RBAC only when identity and server persistence exist |
| AI agent / MCP | Not implemented | Read-only inspect, propose edits, run approved suites, explain evidence; confirmation for destructive actions |

## Release gates

1. A feature must have unit coverage and, where browser behavior is involved, a deterministic fixture-based browser test.
2. Generated projects must be syntax-checked and actually executed, not merely inspected for file names.
3. No feature may report a passing test unless a runner returns a successful exit code and the expected evidence exists.
4. Secrets must stay out of recordings, YAML, screenshots, logs, reports and ZIP artifacts.
5. Multi-tab, popup and iframe support must preserve target context and must never silently run an action in the wrong frame or tab.
6. Cloud execution, schedules, collaboration and integrations require a real authenticated backend; they cannot be honestly delivered by a static page alone.
7. Installed-Chrome smoke tests remain a separate manual release gate.

## Immediate delivery sequence

- **Phase A — recorder parity:** hover, scroll, drag/drop, richer assertions, keyboard and file-upload events.
- **Phase B — editor and test library:** full step editor, folders, suites, reusable components, variables and profiles.
- **Phase C — execution and debugging:** smart waits, local runner bridge, per-step evidence, rewind and visual regression.
- **Phase D — portability and integrations:** YAML schema, CLI, REST/webhooks and GitHub/Slack/Jira/Linear adapters.
- **Phase E — hosted capabilities:** authenticated cloud workers, schedules, parallelism, run history and team RBAC.
