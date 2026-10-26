import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("package, docs, extension manifest and Vercel configuration are valid", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  const readme = await readFile("README.md", "utf8");
  const manifest = JSON.parse(await readFile("extension/manifest.json", "utf8"));
  const vercel = JSON.parse(await readFile("vercel.json", "utf8"));
  assert.equal(pkg.scripts.test, "node --test");
  assert.match(readme, /Playwright \+ Python \+ pytest/);
  assert.match(readme, /Selenium WebDriver \+ Python \+ unittest/);
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.content_scripts[0].matches, ["http://*/*", "https://*/*"]);
  assert.equal(vercel.cleanUrls, true);
});

test("dashboard and extension scripts parse", async () => {
  for (const file of ["app.js", "extension/background.js", "extension/recorder.js", "extension/popup.js"]) {
    const source = await readFile(file, "utf8");
    assert.doesNotThrow(() => new vm.Script(source), file + " must parse");
  }
});

async function generateFromFixture(engine) {
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
  const event = {id:"fixture-1",sequence:1,kind:"click",description:"Click Continue",target:{role:"button",name:"Continue"},locators:[{strategy:"role",value:"button",name:"Continue"}],source:"fixture"};
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
  return {code, runner:el("code").textContent, status:el("status").textContent};
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
