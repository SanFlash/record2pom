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

async function generateFromFixture(engine, kind = "click") {
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
  const context = {document, prompt:(_message, fallback)=>fallback ?? "", confirm:()=>true, setTimeout:()=>{}, URL:FakeURL, window:{}};
  vm.runInNewContext(await readFile("core.js", "utf8"), context);
  context.window.Record2POMCore = context.Record2POMCore;
  vm.runInNewContext(source, context);
  const role = kind === "select" ? "combobox" : "button";
  const name = kind === "select" ? "Country" : "Continue";
  const event = {id:"fixture-1",sequence:1,kind,description:kind === "select" ? "Select Country" : kind === "press" ? "Press Enter" : "Click Continue",target:{role,name},locators:[{strategy:"role",value:role,name}],value:kind === "select" ? "India" : kind === "press" ? "Enter" : undefined,source:"fixture"};
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
  return {code, runner, test:el("code").textContent, status:el("status").textContent};
}

test("Playwright generator binds recorded locator to the page object", async () => {
  const result = await generateFromFixture("playwright");
  assert.match(result.code, /self\.page\.get_by_role/);
  assert.match(result.status, /tests have NOT been executed/);
});

test("Selenium generator binds recorded locator to the page object", async () => {
  const result = await generateFromFixture("selenium");
  assert.match(result.code, /self\.driver\.find_element/);
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
});

test("generated Python files parse when Python is installed", async (t) => {
  const result = await generateFromFixture("playwright");
  const sources = [
    ["pages/recorded_page.py", result.code],
    ["run_tests.py", result.runner],
    ["tests/test_recorded_journey.py", result.test]
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

test("Selenium generator emits real select and keyboard APIs", async () => {
  const select = await generateFromFixture("selenium", "select");
  assert.match(select.code, /Select\(self\.driver\.find_element/);
  assert.match(select.code, /select_by_visible_text\("India"\)/);
  const press = await generateFromFixture("selenium", "press");
  assert.match(press.code, /send_keys\(Keys\.ENTER\)/);
});

test("recorder redacts sensitive select values before export", async () => {
  const source = await readFile("extension/recorder.js", "utf8");
  assert.match(source, /HTMLSelectElement&&!extra\.redacted/);
  assert.match(source, /extra\.redacted=true/);
});
