import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { spawnSync } from "node:child_process";

test("package, docs, extension manifest and Vercel configuration are valid", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  const readme = await readFile("README.md", "utf8");
  const manifest = JSON.parse(await readFile("extension/manifest.json", "utf8"));
  const vercel = JSON.parse(await readFile("vercel.json", "utf8"));
  const fixture = await readFile("fixtures/universal-demo/index.html", "utf8");
  assert.equal(pkg.scripts.test, "node --test");
  assert.match(readme, /Playwright \+ Python \+ pytest/);
  assert.match(readme, /Selenium WebDriver \+ Python \+ unittest/);
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.content_scripts[0].matches, ["http://*/*", "https://*/*"]);
  assert.equal(vercel.cleanUrls, true);
  assert.match(fixture, /id="full-name"/);
  assert.match(fixture, /data-testid="submit-form"/);
});

test("dashboard and extension scripts parse", async () => {
  for (const file of ["core.js", "app.js", "extension/background.js", "extension/recorder.js", "extension/popup.js"]) {
    const source = await readFile(file, "utf8");
    assert.doesNotThrow(() => new vm.Script(source), file + " must parse");
  }
});

async function generateFromFixture(engine, kind = "click", strategy = "role") {
  const source = await readFile("app.js", "utf8");
  const elements = new Map();
  let fileButtons = [];
  function el(id) {
    if (!elements.has(id)) elements.set(id, {id, value:"", textContent:"", innerHTML:"", hidden:false, style:{}, files:[], dataset:{}, click(){}, addEventListener(){}});
    return elements.get(id);
  }
  el("name").value = "fixture-project";
  el("url").value = "https://fixture.test/form";
  el("engine").value = engine;
  el("framework").value = engine === "playwright" ? "pytest" : "unittest";
  const document = {
    getElementById: el,
    querySelectorAll(selector) {
      if (selector === ".action") return [];
      if (selector === "[data-path]") {
        fileButtons = [...el("files").innerHTML.matchAll(/data-path="([^"]+)"/g)].map(m => ({dataset:{path:m[1]}, onclick:null}));
        return fileButtons;
      }
      return [];
    },
    createElement() { return {click(){}}; }
  };
  class FakeURL { constructor(value) { this.protocol = String(value).startsWith("https:") ? "https:" : "invalid:"; } }
  const window = {addEventListener(){}, dispatchEvent(){}};
  const context = {document, prompt:(_message, fallback)=>fallback ?? "", confirm:()=>true, setTimeout:()=>{}, URL:FakeURL, window};
  vm.runInNewContext(await readFile("core.js", "utf8"), context);
  context.window.Record2POMCore = context.Record2POMCore;
  vm.runInNewContext(source, context);
  const role = kind === "select" ? "combobox" : "button";
  const name = kind === "select" ? "Country" : "Continue";
  const event = {id:"fixture-1",sequence:1,kind,description:kind === "select" ? "Select Country" : kind === "press" ? "Press Enter" : "Click Continue",target:strategy === "label" ? {label:"Full name"} : {role,name},locators:strategy === "label" ? [{strategy:"label",value:"Full name"},{strategy:"css",value:"#full-name"}] : [{strategy:"role",value:role,name},{strategy:"css",value:"#continue"}],value:kind === "select" ? "India" : kind === "press" ? "Enter" : kind === "fill" ? "Ada" : undefined,source:"fixture"};
  el("file").files = [{text:async()=>JSON.stringify({targetUrl:"https://fixture.test/form",events:[event]})}];
  await el("file").onchange({target:el("file")});
  el("generate").onclick();
  const button = fileButtons.find(item => item.dataset.path === "pages/recorded_page.py");
  assert.ok(button?.onclick, "page object preview control should be wired");
  button.onclick();
  const code = el("code").textContent;
  const runnerButton = fileButtons.find(item => item.dataset.path === "run_tests.py");
  assert.ok(runnerButton?.onclick, "generated local runner should be listed");
  runnerButton.onclick();
  const runner = el("code").textContent;
  const testButton = fileButtons.find(item => item.dataset.path === "tests/test_recorded_journey.py");
  assert.ok(testButton?.onclick, "generated test module should be listed");
  testButton.onclick();
  const testSource = el("code").textContent;
  const conftestButton = fileButtons.find(item => item.dataset.path === "tests/conftest.py");
  let conftest = "";
  if (conftestButton?.onclick) { conftestButton.onclick(); conftest = el("code").textContent; }
  const configButton = fileButtons.find(item => item.dataset.path === "config.py");
  let config = ""; if (configButton?.onclick) { configButton.onclick(); config = el("code").textContent; }
  const dataButton = fileButtons.find(item => item.dataset.path === "data/recorded_test_data.json");
  let data = ""; if (dataButton?.onclick) { dataButton.onclick(); data = el("code").textContent; }
  const validatorButton = fileButtons.find(item => item.dataset.path === "validate_project.py");
  let validator = ""; if (validatorButton?.onclick) { validatorButton.onclick(); validator = el("code").textContent; }
  return {code, runner, test:testSource, conftest, config, data, validator, status:el("status").textContent};
}

test("Playwright generator binds recorded locator to the page object", async () => {
  const result = await generateFromFixture("playwright");
  assert.match(result.code, /self\.page\.get_by_role/);
  assert.match(result.code, /exact=True/, "Playwright role names must be exact to preserve measured uniqueness");
  assert.match(result.code, /def _resolve_locator/);
  assert.match(result.code, /lambda: self\.page\.get_by_role/);
  assert.match(result.code, /lambda: self\.page\.locator/);
  assert.match(result.status, /tests have NOT been executed/);
});

test("Selenium generator binds recorded locator to the page object", async () => {
  const result = await generateFromFixture("selenium");
  assert.match(result.code, /self\.driver\.find_element/);
  assert.match(result.code, /self::button/, "Selenium role locators must support native HTML buttons");
  assert.match(result.code, /def _resolve_locator/);
  assert.match(result.code, /find_elements\(By\.XPATH/);
  assert.match(result.code, /find_elements\(By\.CSS_SELECTOR/);
  assert.match(result.status, /tests have NOT been executed/);
  assert.match(result.runner, /unittest.*discover/s);
  assert.match(result.runner, /pytest-playwright/);
});

test("shared event schema rejects unsupported kinds and caps recordings", async () => {
  const context = {window:{}};
  vm.runInNewContext(await readFile("core.js", "utf8"), context);
  const core = context.Record2POMCore;
  assert.equal(core.validateRecording({schemaVersion:1,events:[{kind:"click"}]}).ok, true);
  assert.equal(core.validateRecording({schemaVersion:99,events:[]}).ok, false);
  assert.equal(core.validateRecording({events:[{kind:"shell-exec"}]}).ok, false);
  assert.equal(core.validateRecording({events:Array.from({length:5001},()=>({kind:"click"}))}).ok, false);
});

test("selector ranking prefers measured unique candidates and reports ambiguity", async () => {
  const context = {window:{}};
  vm.runInNewContext(await readFile("core.js", "utf8"), context);
  const ranked = context.Record2POMCore.rankLocators([
    {strategy:"testId",value:"continue",matchCount:2},
    {strategy:"css",value:"#continue",matchCount:1}
  ]);
  assert.equal(ranked[0].value, "#continue");
  assert.equal(context.Record2POMCore.assessLocator(ranked[1]).status, "ambiguous");
});

test("generated runner uses no shell, applies timeout and documents result files", async () => {
  const result = await generateFromFixture("playwright");
  assert.match(result.runner, /shell=False/);
  assert.match(result.runner, /timeout=timeout/);
  assert.match(result.runner, /run-results\.json/);
  assert.match(result.runner, /run\.log/);
  assert.match(result.runner, /diagnostics\.json/);
  assert.match(result.runner, /diagnostics\.html/);
  assert.match(result.runner, /failureCount/);
  assert.match(result.runner, /Locator fallback hints/);
  assert.match(result.runner, /repairSuggestions/);
  assert.match(result.runner, /locator-not-unique/);
  assert.match(result.runner, /Suggested next steps/);
  assert.match(result.runner, /screenshots/);
  assert.match(result.runner, /Failure screenshots/);
});

test("generated Python files parse when Python is installed", async (t) => {
  const result = await generateFromFixture("playwright");
  const sources = [
    ["pages/recorded_page.py", result.code],
    ["run_tests.py", result.runner],
    ["tests/test_recorded_journey.py", result.test],
    ...(result.conftest ? [["tests/conftest.py", result.conftest]] : [])
  ];
  let python = "python3";
  let probe = spawnSync(python, ["--version"], {encoding:"utf8"});
  if (probe.error?.code === "ENOENT") {
    python = "python";
    probe = spawnSync(python, ["--version"], {encoding:"utf8"});
  }
  if (probe.error?.code === "ENOENT") return t.skip("Python is not installed in this environment.");
  assert.equal(probe.status, 0, "Python interpreter should start");
  for (const [name, source] of sources) {
    const check = spawnSync(python, ["-c", "import ast,sys; ast.parse(sys.stdin.read())"], {input:source, encoding:"utf8"});
    assert.equal(check.status, 0, name + " must parse: " + check.stderr);
  }
});

test("core recorder and generator remain website-agnostic", async () => {
  for (const file of ["app.js", "core.js", "extension/recorder.js"]) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /orangehrm/i, file + " must not contain target-specific assumptions");
  }
});

test("Selenium label locators resolve associated controls, not the label node", async () => {
  const result = await generateFromFixture("selenium", "fill", "label");
  assert.match(result.code, /descendant-or-self::/);
  assert.match(result.code, /self::input or self::textarea or self::select/);
});

test("Selenium generator emits real select and keyboard APIs", async () => {
  const select = await generateFromFixture("selenium", "select");
  assert.match(select.code, /Select\(self\._resolve_locator/);
  assert.match(select.code, /select_by_visible_text\("India"\)/);
  const press = await generateFromFixture("selenium", "press");
  assert.match(press.code, /send_keys\(Keys\.ENTER\)/);
});

test("recorder redacts sensitive select values before export", async () => {
  const source = await readFile("extension/recorder.js", "utf8");
  assert.match(source, /element instanceof HTMLSelectElement/);
  assert.match(source, /if \(sensitive\(element\)\)/);
  assert.match(source, /extra\.redacted = true/);
});


test("canonical recording IR normalizes legacy aliases and locator candidates", async () => {
  const context = {window:{}};
  vm.runInNewContext(await readFile("core.js", "utf8"), context);
  const result = context.Record2POMCore.normalizeRecording({
    targetUrl:"https://example.test/form",
    events:[{type:"input", target:{label:"Full name"}, value:"Ada", locatorCandidates:[{type:"label",selector:"Full name"}]}]
  });
  assert.equal(result.ok, true);
  assert.equal(result.recording.schemaVersion, 1);
  assert.equal(result.recording.targetUrl, "https://example.test/form");
  assert.equal(result.recording.events[0].kind, "fill");
  assert.equal(result.recording.events[0].locators[0].strategy, "label");
  assert.equal(result.recording.events[0].locators[0].value, "Full name");
});

test("canonical recording IR removes sensitive values and bounds event data", async () => {
  const context = {window:{}};
  vm.runInNewContext(await readFile("core.js", "utf8"), context);
  const result = context.Record2POMCore.normalizeRecording({
    schemaVersion:1,
    events:[{kind:"fill", value:"never-export-this", sensitivity:"sensitive", envVar:"LOGIN_PASSWORD", milliseconds:90000}]
  });
  assert.equal(result.ok, true);
  assert.equal("value" in result.recording.events[0], false);
  assert.equal(result.recording.events[0].redacted, true);
  assert.equal(result.recording.events[0].envVar, "LOGIN_PASSWORD");
  assert.equal(result.recording.events[0].milliseconds, 30000);
});


test("Playwright generated project captures failure screenshots", async () => {
  const result = await generateFromFixture("playwright");
  assert.match(result.code, /def _resolve_locator/);
  assert.match(result.code, /def _step/);
  assert.match(result.code, /steps\.json/);
  assert.match(result.code, /durationMs/);
  assert.match(result.runner, /steps\.html/);
  assert.match(result.runner, /Step execution timeline/);
  assert.match(result.runner, /reports\/steps\.html/);
  assert.match(result.runner, /screenshots/, "runner should prepare a screenshot output directory");
  assert.match(result.runner, /glob\(/, "runner should discover generated screenshot files");
  assert.match(result.runner, /Failure screenshots/);
  assert.match(result.runner, /diagnostics\["screenshots"\]/);
  assert.match(result.conftest, /pytest_runtest_makereport/);
  assert.match(result.conftest, /page\.screenshot/);
});

test("generated Selenium project Python files parse", async (t) => {
  const result = await generateFromFixture("selenium");
  assert.match(result.test, /save_screenshot/);
  assert.match(result.test, /reports\/screenshots/);
  assert.match(result.code, /def _step/);
  assert.match(result.code, /steps\.json/);
  assert.match(result.code, /durationMs/);
  assert.match(result.runner, /steps\.html/);
  assert.match(result.runner, /Step execution timeline/);
  let python = "python3";
  let probe = spawnSync(python, ["--version"], {encoding:"utf8"});
  if (probe.error?.code === "ENOENT") {
    python = "python";
    probe = spawnSync(python, ["--version"], {encoding:"utf8"});
  }
  if (probe.error?.code === "ENOENT") return t.skip("Python is not installed in this environment.");
  assert.equal(probe.status, 0);
  for (const [name, source] of [
    ["pages/recorded_page.py", result.code],
    ["run_tests.py", result.runner],
    ["tests/test_recorded_journey.py", result.test]
  ]) {
    const check = spawnSync(python, ["-c", "import ast,sys; ast.parse(sys.stdin.read())"], {input:source, encoding:"utf8"});
    assert.equal(check.status, 0, name + " must parse: " + check.stderr);
  }
});

test("reviewed recording export uses canonical normalization and redaction", async () => {
  const source = await readFile("app.js", "utf8");
  const html = await readFile("index.html", "utf8");
  assert.match(html, /id="exportRecording"/);
  assert.match(source, /function exportReviewedRecording\(\)/);
  assert.match(source, /normalizeRecording\(payload\)/);
  assert.match(source, /Sensitive values are omitted by the canonical normalizer/);
});

test("generator emits explicit assertion actions for both engines", async () => {
  for (const engine of ["playwright", "selenium"]) {
    const visible = await generateFromFixture(engine, "assert-visible");
    assert.match(visible.code, /is_visible\(\)|is_displayed\(\)/);
    const text = await generateFromFixture(engine, "assert-text");
    assert.match(text.code, engine === "playwright" ? /get_by_text/ : /By\.TAG_NAME/);
  }
});


test("dashboard includes actionable readiness pre-flight for URL, locators, assertions and redaction", async () => {
  const html = await readFile("index.html", "utf8");
  const source = await readFile("app.js", "utf8");
  const css = await readFile("styles.css", "utf8");
  assert.match(html, /id="checkReadiness"/);
  assert.match(html, /id="readinessList"/);
  assert.match(source, /function checkReadiness\(\)/);
  assert.match(source, /Required actions have locators/);
  assert.match(source, /No explicit assertions found/);
  assert.match(source, /sensitive input\(s\) need environment variables/);
  assert.match(source, /Execution happens on your machine/);
  assert.match(css, /\.readiness-summary\.has-blockers/);
});


test("GSAP Motion Lab includes responsive 3D visuals and reduced-motion fallback", async () => {
  const showcase = await readFile("showcase/index.html", "utf8");
  const banner = await readFile("assets/record2pom-motion.svg", "utf8");
  const visual = await readFile("assets/record2pom-banner.svg", "utf8");
  assert.match(showcase, /gsap\.min\.js/);
  assert.match(showcase, /prefers-reduced-motion/);
  assert.match(showcase, /perspective:\s*1200px/);
  assert.match(showcase, /pointermove/);
  assert.match(showcase, /IntersectionObserver/);
  assert.match(showcase, /Launch Record2POM/);
  assert.match(showcase, /@media\(max-width:560px\)/);
  assert.match(banner, /<animateTransform/);
  assert.match(visual, /Record2POM/);
});


test("extension background lifecycle persists sessions and redacts sensitive values", async () => {
  const storage = {};
  let messageListener;
  const chrome = {
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: { addListener(fn) { messageListener = fn; } }
    },
    storage: {
      local: {
        async get(key) { return {[key]: storage[key]}; },
        async set(value) { Object.assign(storage, value); }
      }
    },
    tabs: { onUpdated: { addListener() {} }, async sendMessage() {} }
  };
  const context = {chrome, console, Date, JSON, Error, String, RegExp};
  vm.runInNewContext(await readFile("extension/background.js", "utf8"), context);
  const send = message => new Promise(resolve => {
    const keepAlive = messageListener(message, {tab:{url:"https://fixture.test"}}, resolve);
    assert.equal(keepAlive, true);
  });
  let result = await send({type:"R2POM_START", url:"https://fixture.test"});
  assert.equal(result.ok, true);
  assert.equal(result.session.recording, true);
  result = await send({type:"R2POM_EVENT", event:{kind:"fill", value:"do-not-store", target:{inputType:"password",name:"password"}}});
  assert.equal(result.ok, true);
  let session = (await send({type:"R2POM_GET_SESSION"})).session;
  assert.equal(session.events.length, 1);
  assert.equal(session.events[0].redacted, true);
  assert.equal("value" in session.events[0], false);
  await send({type:"R2POM_PAUSE"});
  await send({type:"R2POM_EVENT", event:{kind:"click", description:"paused click"}});
  session = (await send({type:"R2POM_GET_SESSION"})).session;
  assert.equal(session.events.length, 1, "paused sessions must not collect events");
  await send({type:"R2POM_STOP"});
  session = (await send({type:"R2POM_GET_SESSION"})).session;
  assert.equal(session.recording, false);
  assert.ok(session.stoppedAt);
  result = await send({type:"R2POM_CLEAR"});
  assert.equal(result.session.events.length, 0);
  result = await send({type:"R2POM_EVENT", event:{kind:"unsupported"}});
  assert.equal(result.ok, false);
});


test("extension branding assets exist and all manifest references resolve", async () => {
  const manifest = JSON.parse(await readFile("extension/manifest.json", "utf8"));
  const popup = await readFile("extension/popup.html", "utf8");
  const assets = new Set([
    ...Object.values(manifest.icons || {}),
    ...Object.values(manifest.action?.default_icon || {}),
    manifest.action?.default_popup,
    manifest.background?.service_worker,
    ...(manifest.content_scripts || []).flatMap(script => script.js || []),
    ...Array.from(popup.matchAll(/(?:src|href)="([^"]+\.(?:png|svg|css|js))"/g), match => match[1])
  ].filter(Boolean));
  for (const asset of assets) {
    await assert.doesNotReject(
      readFile("extension/" + asset),
      "Extension asset referenced by manifest/popup must exist: " + asset
    );
  }
  assert.match(popup, /alt="Record2POM logo"/);
  assert.match(popup, /id="start"/);
  assert.match(popup, /id="pause"/);
  assert.match(popup, /id="stop"/);
  assert.match(popup, /id="export"/);
  assert.match(popup, /id="clear"/);
  const popupScript = await readFile("extension/popup.js", "utf8");
  const background = await readFile("extension/background.js", "utf8");
  assert.match(popupScript, /renderImportStatus/);
  assert.match(popupScript, /record2pom_import_status_v1/);
  assert.match(popup, /id="transferState"/);
  assert.match(popup, /id="transferDetail"/);
  assert.match(background, /ok:null,eventCount:s.events.length/);
});


test("extension stop flow hands recorded sessions to Studio for automatic POM generation", async () => {
  const background = await readFile("extension/background.js", "utf8");
  const popup = await readFile("extension/popup.js", "utf8");
  const popupHtml = await readFile("extension/popup.html", "utf8");
  const studio = await readFile("app.js", "utf8");

  assert.match(background, /R2POM_GENERATE_POM/);
  assert.match(background, /record2pom:import-recording/);
  assert.match(background, /chrome\.scripting\.executeScript/);
  assert.match(popup, /R2POM_STOP[\s\S]*?R2POM_GENERATE_POM/);
  assert.match(popupHtml, /id="generatePom"/);
  assert.match(studio, /addEventListener\(["']record2pom:import-recording["']/);
  assert.match(studio, /generatedButton\.click\(\)/);
});


test("generated project includes a preflight validator for files, JSON and Python syntax", async () => {
  const result = await generateFromFixture("playwright", "select");
  assert.match(result.validator, /ast\.parse/);
  assert.match(result.validator, /recorded_test_data\.json/);
  assert.match(result.validator, /redacted/);
  assert.match(result.validator, /Python syntax checked/);
});


test("Playwright select actions recover native controls by option text when accessible names are unstable", async () => {
  const select = await generateFromFixture("playwright", "select");
  assert.match(select.code, /def _resolve_select_locator\(self, label\)/);
  assert.match(select.code, /self\._resolve_select_locator\("India"\)\.select_option\(label="India"\)/);
  assert.ok(select.code.includes("all_text_contents()"));
  assert.ok(select.code.includes("locator(\'option\')") || select.code.includes('locator("option")'));
  assert.match(select.code, /Expected exactly one native select containing option/);
  assert.ok(select.code.includes("timeout=2500"));
  assert.ok(select.config.includes("BASE_URL = os.environ.get"));
  assert.doesNotThrow(() => JSON.parse(select.data));
  assert.equal(JSON.parse(select.data).steps[0].value, "India");
});
