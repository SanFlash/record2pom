import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

class FakeElement {
  constructor(tagName, attrs = {}, props = {}) {
    this.tagName = tagName.toUpperCase();
    this.attrs = { ...attrs };
    Object.assign(this, props);
    this.innerText ??= "";
    this.offsetWidth = 100;
    this.offsetHeight = 20;
    this.disabled ??= false;
    this.labels ??= [];
  }
  getAttribute(name) { return this.attrs[name] ?? null; }
  hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name); }
  matches(selector) {
    if (selector.includes("button") && this.tagName === "BUTTON") return true;
    if (selector.includes("input[type=button]") && this.tagName === "INPUT" && this.type === "button") return true;
    if (selector.includes("input[type=submit]") && this.tagName === "INPUT" && this.type === "submit") return true;
    if (selector.includes("input:not(") && this.tagName === "INPUT" && !["button","submit","reset","checkbox","radio","file","hidden","image"].includes(this.type)) return true;
    if (selector.includes("textarea") && this.tagName === "TEXTAREA") return true;
    if (selector.includes("select") && this.tagName === "SELECT") return true;
    if (selector.includes("a[href]") && this.tagName === "A" && this.attrs.href) return true;
    if (selector.includes("[data-testid]") && this.attrs["data-testid"]) return true;
    if (selector.includes("[data-test]") && this.attrs["data-test"]) return true;
    if (selector.includes("[data-qa]") && this.attrs["data-qa"]) return true;
    if (selector.includes("[role]") && this.attrs.role) return true;
    if (selector.includes("[role=textbox]") && this.attrs.role === "textbox") return true;
    if (selector.includes("[role=combobox]") && this.attrs.role === "combobox") return true;
    if (selector.includes("[role=button]") && this.attrs.role === "button") return true;
    if (selector.includes("[role=link]") && this.attrs.role === "link") return true;
    if (selector.includes("[role=menuitem]") && this.attrs.role === "menuitem") return true;
    if (selector.includes("[role=tab]") && this.attrs.role === "tab") return true;
    if (selector.includes("[role=option]") && this.attrs.role === "option") return true;
    if (selector.includes("[role=checkbox]") && this.attrs.role === "checkbox") return true;
    if (selector.includes("[role=radio]") && this.attrs.role === "radio") return true;
    if (selector.includes("[aria-haspopup]") && this.attrs["aria-haspopup"]) return true;
    if (selector.includes("[onclick]") && this.attrs.onclick) return true;
    if (selector.includes("[contenteditable=true]") && this.attrs.contenteditable === "true") return true;
    if (selector.includes("summary") && this.tagName === "SUMMARY") return true;
    if (selector.includes("[tabindex]") && this.attrs.tabindex !== undefined) return true;
    return false;
  }
  getClientRects() { return [1]; }
}
class FakeInput extends FakeElement {}
class FakeTextarea extends FakeElement {}
class FakeSelect extends FakeElement {}

async function recorderHarness({ session = { recording: false, paused: false }, elements = [] } = {}) {
  const documentListeners = {};
  const runtimeListeners = [];
  const sent = [];
  const document = {
    title: "Fixture page",
    addEventListener(type, fn) { (documentListeners[type] ??= []).push(fn); },
    getElementById(id) { return elements.find(e => e.id === id) ?? null; },
    querySelectorAll(selector) {
      if (selector === "[data-testid]") return elements.filter(e => e.getAttribute("data-testid"));
      if (selector === "label") return elements.filter(e => e.tagName === "LABEL");
      if (selector === "[placeholder]") return elements.filter(e => e.getAttribute("placeholder"));
      if (selector.startsWith("#")) return elements.filter(e => e.id === selector.slice(1));
      const attributeMatch = selector.match(/^\[(data-test|data-qa|data-testid)="(.*)"\]$/);
      if (attributeMatch) return elements.filter(e => e.getAttribute(attributeMatch[1]) === attributeMatch[2]);
      if (selector.startsWith("button,") || selector === "[role]") return elements.filter(e =>
        ["BUTTON", "A", "INPUT", "TEXTAREA", "SELECT"].includes(e.tagName) || e.getAttribute("role"));
      return elements;
    }
  };
  const chrome = { runtime: {
    onMessage: { addListener(fn) { runtimeListeners.push(fn); } },
    sendMessage(message) {
      sent.push(message);
      if (message.type === "R2POM_GET_SESSION") return Promise.resolve({ ok: true, session });
      return Promise.resolve({ ok: true });
    }
  }};
  const windowListeners = {};
  const window = { addEventListener(type, fn) { (windowListeners[type] ??= []).push(fn); } };
  const context = {
    window, document, chrome, location: { href: "https://fixture.test/login", origin: "https://fixture.test" },
    URL, URLSearchParams, Date, Math, String, Array, RegExp, CSS: { escape: value => value },
    Element: FakeElement, HTMLInputElement: FakeInput, HTMLTextAreaElement: FakeTextarea, HTMLSelectElement: FakeSelect,
    setTimeout, clearTimeout, console
  };
  const script = await readFile("extension/recorder.js", "utf8");
  vm.runInNewContext(script, context);
  await Promise.resolve();
  const fire = (type, event) => (documentListeners[type] || []).forEach(fn => fn(event));
  const control = message => runtimeListeners.forEach(fn => fn(message));
  return { sent, fire, control, documentListeners, window, setSession(value) { session = value; } };
}

test("recorder installs recording and inspect listeners once and stays idle until recording starts", async () => {
  const button = new FakeElement("button", { "aria-label": "Continue" });
  const h = await recorderHarness({ elements: [button] });
  h.fire("click", { composedPath: () => [button], target: button });
  assert.equal(h.sent.filter(m => m.type === "R2POM_EVENT").length, 0);
  assert.equal(h.window.__record2pomInstalled, true);
  assert.equal(h.documentListeners.click.length, 2, "one click listener records actions and one handles Inspect mode");
});

test("recorder captures semantic submit success checkpoints only with expected action labels", async () => {
  const button = new FakeElement("button", {"aria-label":"Login"});
  const h = await recorderHarness({session:{recording:true,paused:false},elements:[button]});
  h.fire("click",{composedPath:()=>[button],target:button});
  const events=h.sent.filter(m=>m.type==="R2POM_EVENT").map(m=>m.event);
  assert.equal(events[0].kind,"assert-visible");
  assert.equal(events[1].kind,"click");
  assert.ok(events.some(e=>e.kind==="assert-url" && e.verification?.generated===true));
  assert.equal(events.find(e=>e.kind==="assert-url").assertion.expected,"/inventory.html");
});

test("recorder captures clicks with locator confidence metadata while active", async () => {
  const button = new FakeElement("button", { "aria-label": "Continue", "data-testid": "continue-btn" });
  const h = await recorderHarness({ session: { recording: true, paused: false }, elements: [button] });
  h.fire("click", { composedPath: () => [button], target: button });
  const event = h.sent.filter(m => m.type === "R2POM_EVENT").map(m=>m.event).find(e=>e.kind==="click");
  assert.equal(event.kind, "click");
  assert.equal(event.target.name, "Continue");
  assert.equal(event.locators[0].strategy, "testId");
  assert.equal(event.locators[0].confidence, "high");
  assert.match(event.description, /Continue/);
});

test("first click asserts visibility before the click and live input values are captured automatically", async () => {
  const email = new FakeInput("input", { name: "email", placeholder: "Work email" }, { type: "email", name: "email", value: "" });
  const h = await recorderHarness({ session: { recording: true, paused: false }, elements: [email] });
  h.fire("click", { composedPath: () => [email], target: email });
  email.value = "qa@example.test";
  h.fire("input", { target: email });
  await new Promise(resolve => setTimeout(resolve, 350));
  const events = h.sent.filter(m => m.type === "R2POM_EVENT").map(m => m.event);
  assert.equal(events[0].kind, "assert-visible", "first-click assertion must be emitted before the action");
  assert.equal(events[0].assertion.expected, "visible");
  assert.equal(events[1].kind, "click");
  assert.equal(events[2].kind, "fill");
  assert.equal(events[2].value, "qa@example.test");
  assert.equal(events[2].sourceClickId, events[1].id);
  assert.equal(events[2].capturedAutomatically, true);
  assert.match(events[2].dataKey, /^email_/);
});

test("repeated fills of the same field retain separate data keys and values", async () => {
  const input = new FakeInput("input", {name:"searchTerm"}, {type:"text",name:"searchTerm",value:""});
  const h = await recorderHarness({session:{recording:true,paused:false},elements:[input]});
  h.fire("click",{composedPath:()=>[input],target:input});
  input.value="first search";
  h.fire("input",{target:input});
  await new Promise(resolve=>setTimeout(resolve,350));
  h.fire("click",{composedPath:()=>[input],target:input});
  input.value="second search";
  h.fire("input",{target:input});
  await new Promise(resolve=>setTimeout(resolve,350));
  const fills=h.sent.filter(m=>m.type==="R2POM_EVENT").map(m=>m.event).filter(e=>e.kind==="fill");
  assert.equal(fills.length,2);
  assert.equal(fills[0].value,"first search");
  assert.equal(fills[1].value,"second search");
  assert.notEqual(fills[0].dataKey,fills[1].dataKey);
  assert.notEqual(fills[0].sourceClickId,fills[1].sourceClickId);
});

test("sensitive input values are never captured even when the user types on the live page", async () => {
  const password = new FakeInput("input", { name: "userPassword", autocomplete: "current-password" }, { type: "password", name: "userPassword", value: "" });
  const h = await recorderHarness({ session: { recording: true, paused: false }, elements: [password] });
  h.fire("click", { composedPath: () => [password], target: password });
  password.value = "do-not-store";
  h.fire("input", { target: password });
  h.fire("change", { target: password });
  const events = h.sent.filter(m => m.type === "R2POM_EVENT").map(m => m.event);
  const fill = events.find(e => e.kind === "fill");
  assert.ok(fill);
  assert.equal(fill.redacted, true);
  assert.equal("value" in fill, false);
  assert.ok(!JSON.stringify(events).includes("do-not-store"));
});

test("recorder prioritizes the actual input over a data-testid wrapper", async () => {
  const input = new FakeInput("input", {name:"accountEmail", placeholder:"Email"}, {type:"email",name:"accountEmail",value:"typed-on-page"});
  const wrapper = new FakeElement("div", {"data-testid":"email-field"});
  const h = await recorderHarness({session:{recording:true,paused:false},elements:[input,wrapper]});
  h.fire("click",{composedPath:()=>[input,wrapper],target:input});
  const event=h.sent.filter(message=>message.type==="R2POM_EVENT").map(m=>m.event).find(e=>e.kind==="click");
  assert.equal(event.kind,"click");
  assert.equal(event.target.tagName,"input");
  assert.equal(event.inputKind,"fill");
  assert.equal(event.dataKey,"accountemail");
  assert.equal("value" in event,false);
});

test("non-editable ARIA comboboxes remain click actions instead of requesting text data", async () => {
  const combo = new FakeElement("div", {role:"combobox","aria-label":"Choose a category"});
  const h = await recorderHarness({session:{recording:true,paused:false},elements:[combo]});
  h.fire("click",{composedPath:()=>[combo],target:combo});
  const event=h.sent.filter(message=>message.type==="R2POM_EVENT").map(m=>m.event).find(e=>e.kind==="click");
  assert.equal(event.kind,"click");
  assert.equal(event.requiresTestData,undefined);
});

test("recorder treats contenteditable and ARIA textboxes as fill actions", async () => {
  const content = new FakeElement("div", {"contenteditable":"true","aria-label":"Notes"});
  content.isContentEditable=true;
  const textbox = new FakeElement("div", {role:"textbox","aria-label":"Description"});
  const h = await recorderHarness({session:{recording:true,paused:false},elements:[content,textbox]});
  h.fire("click",{composedPath:()=>[content],target:content});
  h.fire("click",{composedPath:()=>[textbox],target:textbox});
  const events=h.sent.filter(message=>message.type==="R2POM_EVENT").map(message=>message.event).filter(event=>event.kind==="click");
  assert.equal(events.length,2);
  assert.ok(events.every(event=>event.kind==="click"&&event.inputKind==="fill"));
});

test("recorder marks dropdown clicks for explicit test data and retains checkbox and Enter actions", async () => {
  const checkbox = new FakeInput("input", { type: "checkbox", "aria-label": "Accept terms" }, { type: "checkbox", checked: true });
  const select = new FakeSelect("select", { "aria-label": "Country" }, { value: "in", selectedOptions: [{ label: "India" }] });
  const textbox = new FakeInput("input", { name: "search", "aria-label": "Search" }, { type: "text", name: "search", value: "abc" });
  const h = await recorderHarness({ session: { recording: true, paused: false }, elements: [checkbox, select, textbox] });
  h.fire("change", { target: checkbox });
  h.fire("click", { composedPath: () => [select], target: select });
  h.fire("change", { target: select });
  h.fire("keydown", { key: "Enter", target: textbox });
  h.control({ type: "R2POM_CONTROL", recording: true, paused: true });
  h.fire("change", { target: textbox });
  const events = h.sent.filter(m => m.type === "R2POM_EVENT").map(m => m.event);
  assert.deepEqual(events.filter(e => !e.verification?.generated).map(e => e.kind), ["check", "click", "select", "press"]);
  const dropdown=events.find(e=>e.kind==="click"&&e.inputKind==="select");
  assert.ok(dropdown);
  assert.equal(events.find(e=>e.kind==="select").value,"in");
  assert.equal(events.find(e=>e.kind==="press").value, "Enter");
});

test("recorder reports navigation only while recording and not paused", async () => {
  const h = await recorderHarness({ session: { recording: true, paused: false } });
  h.control({ type: "R2POM_NAVIGATION", url: "https://fixture.test/next?access_token=secret123&view=profile#access_token=hashsecret" });
  await new Promise(resolve => setImmediate(resolve));
  let event = h.sent.find(m => m.type === "R2POM_EVENT")?.event;
  assert.equal(event.kind, "navigate");
  assert.equal(event.page.origin, "https://fixture.test");
  assert.match(event.url, /access_token=__REDACTED__/);
  assert.match(event.url, /view=profile/);
  assert.ok(!event.url.includes("secret123"));
  assert.ok(!event.url.includes("hashsecret"));
  h.control({ type: "R2POM_CONTROL", recording: true, paused: true });
  h.setSession({ recording: true, paused: true });
  h.control({ type: "R2POM_NAVIGATION", url: "https://fixture.test/paused" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.sent.filter(m => m.type === "R2POM_EVENT").length, 1);
});


test("recorder assigns semantic checkbox and radio roles and ignores file paths", async () => {
  const checkbox = new FakeInput("input", { type: "checkbox", "aria-label": "Receive updates" }, { type: "checkbox", checked: true });
  const radio = new FakeInput("input", { type: "radio", "aria-label": "Monthly" }, { type: "radio", checked: true });
  const file = new FakeInput("input", { type: "file", name: "attachment" }, { type: "file", name: "attachment", value: "C:\\fakepath\\private.pdf" });
  const h = await recorderHarness({ session: { recording: true, paused: false }, elements: [checkbox, radio, file] });
  h.fire("change", { target: checkbox });
  h.fire("change", { target: radio });
  h.fire("change", { target: file });
  const events = h.sent.filter(message => message.type === "R2POM_EVENT").map(message => message.event);
  assert.equal(events.length, 2, "file input values must never be recorded");
  assert.equal(events[0].target.role, "checkbox");
  assert.equal(events[1].target.role, "radio");
  assert.ok(events[0].locators.some(locator => locator.strategy === "role" && locator.value === "checkbox"));
  assert.ok(events[1].locators.some(locator => locator.strategy === "role" && locator.value === "radio"));
});

test("recorder ignores invalid navigation protocols and tolerates missing composedPath", async () => {
  const button = new FakeElement("button", { "aria-label": "Save" });
  const h = await recorderHarness({ session: { recording: true, paused: false }, elements: [button] });
  h.fire("click", { target: button });
  assert.equal(h.sent.filter(message => message.type === "R2POM_EVENT").length, 2);
  h.control({ type: "R2POM_NAVIGATION", url: "javascript:alert(1)" });
  assert.equal(h.sent.filter(message => message.type === "R2POM_EVENT").length, 2);
});


test("recorder does not mislabel data-test/data-qa attributes as data-testid locators", async () => {
  const custom = new FakeElement("button", { "aria-label": "Open", "data-test": "open-control" });
  const h = await recorderHarness({ session: { recording: true, paused: false }, elements: [custom] });
  h.fire("click", { composedPath: () => [custom], target: custom });
  const event = h.sent.find(message => message.type === "R2POM_EVENT")?.event;
  assert.equal(event.target.testId, "");
  assert.ok(event.locators.some(locator => locator.strategy === "css" && locator.value === '[data-test="open-control"]'));
  assert.ok(!event.locators.some(locator => locator.strategy === "testId"));
});


test("typed input is stored as fill data and never becomes an expected value assertion", async () => {
  const input = new FakeInput("input", {name:"displayName", "aria-label":"Display name", "data-testid":"display-name"}, {type:"text", name:"displayName", value:""});
  const h = await recorderHarness({session:{recording:true,paused:false},elements:[input]});
  h.fire("click",{composedPath:()=>[input],target:input});
  input.value="Ada Lovelace";
  h.fire("change",{target:input});
  const events=h.sent.filter(m=>m.type==="R2POM_EVENT").map(m=>m.event);
  assert.equal(events[0].kind,"assert-visible");
  assert.equal(events[1].kind,"click");
  assert.equal(events[2].kind,"fill");
  assert.equal(events[2].value,"Ada Lovelace");
  assert.equal(events.some(e=>e.kind==="assert-value"),false);
});

test("sensitive inputs create only redacted fill metadata and no value assertion", async () => {
  const input = new FakeInput("input", {name:"password", "aria-label":"Password"}, {type:"password", name:"password", value:""});
  const h = await recorderHarness({session:{recording:true,paused:false},elements:[input]});
  h.fire("click",{composedPath:()=>[input],target:input});
  input.value="secret-value";
  h.fire("change",{target:input});
  const events=h.sent.filter(m=>m.type==="R2POM_EVENT").map(m=>m.event);
  const fill=events.find(e=>e.kind==="fill");
  assert.ok(fill);
  assert.equal(fill.redacted,true);
  assert.equal("value" in fill,false);
  assert.equal(events.some(e=>e.kind==="assert-value"),false);
  assert.ok(!JSON.stringify(events).includes("secret-value"));
});
