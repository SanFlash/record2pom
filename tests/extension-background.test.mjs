import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const KEY = "record2pom_session_v1";

function harness() {
  const store = {};
  const installed = [];
  const messages = [];
  const updates = [];
  const sentTabMessages = [];
  const chrome = {
    storage: { local: {
      async get(key) { return { [key]: store[key] }; },
      async set(values) { Object.assign(store, values); }
    }},
    runtime: {
      onInstalled: { addListener(fn) { installed.push(fn); } },
      onMessage: { addListener(fn) { messages.push(fn); } }
    },
    tabs: {
      onUpdated: { addListener(fn) { updates.push(fn); } },
      async sendMessage(tabId, message) { sentTabMessages.push({ tabId, message }); }
    }
  };
  const source = readFile("extension/background.js", "utf8");
  return source.then((script) => {
    vm.runInNewContext(script, { chrome, Date, Error, console, URL, URLSearchParams });
    async function dispatch(message, sender = { tab: { url: "https://example.test/" } }) {
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Background message timed out")), 1000);
        const keepAlive = messages[0](message, sender, (response) => {
          clearTimeout(timer);
          resolve(response);
        });
        assert.equal(keepAlive, true, "message listener must keep the response channel open");
      });
    }
    return { store, installed, dispatch, updates, sentTabMessages };
  });
}

test("extension initializes a persistent idle session and returns it", async () => {
  const h = await harness();
  await h.installed[0]();
  const result = await h.dispatch({ type: "R2POM_GET_SESSION" });
  assert.equal(result.ok, true);
  assert.equal(result.session.schemaVersion, 1);
  assert.equal(result.session.recording, false);
  assert.deepEqual(Array.from(result.session.events), []);
  assert.ok(h.store[KEY]);
});

test("extension start, pause, resume, stop and clear enforce the recording lifecycle", async () => {
  const h = await harness();
  await h.installed[0]();
  const started = await h.dispatch({ type: "R2POM_START", url: "https://example.test/form?api_key=topsecret&mode=edit" });
  assert.equal(started.session.recording, true);
  assert.match(started.session.targetUrl, /api_key=__REDACTED__/);
  assert.ok(!started.session.targetUrl.includes("topsecret"));
  assert.match(started.session.targetUrl, /mode=edit/);
  assert.equal(started.session.paused, false);
  assert.equal(started.session.targetUrl, "https://example.test/form?api_key=__REDACTED__&mode=edit");
  assert.ok(started.session.startedAt);

  await h.dispatch({ type: "R2POM_EVENT", event: { kind: "click", target: { role: "button" } } });
  const paused = await h.dispatch({ type: "R2POM_PAUSE" });
  assert.equal(paused.session.paused, true);
  await h.dispatch({ type: "R2POM_EVENT", event: { kind: "fill", value: "should-not-record" } });
  assert.equal((await h.dispatch({ type: "R2POM_GET_SESSION" })).session.events.length, 1);

  const resumed = await h.dispatch({ type: "R2POM_RESUME" });
  assert.equal(resumed.session.paused, false);
  await h.dispatch({ type: "R2POM_EVENT", event: { kind: "click", target: { role: "link" } } });
  const stopped = await h.dispatch({ type: "R2POM_STOP" });
  assert.equal(stopped.session.recording, false);
  assert.ok(stopped.session.stoppedAt);
  await h.dispatch({ type: "R2POM_EVENT", event: { kind: "click" } });
  assert.equal((await h.dispatch({ type: "R2POM_GET_SESSION" })).session.events.length, 2);

  const cleared = await h.dispatch({ type: "R2POM_CLEAR" });
  assert.equal(cleared.session.recording, false);
  assert.equal(cleared.session.events.length, 0);
});

test("pause and resume cannot accidentally start an idle session", async () => {
  const h = await harness();
  await h.installed[0]();
  const pause = await h.dispatch({ type: "R2POM_PAUSE" });
  const resume = await h.dispatch({ type: "R2POM_RESUME" });
  assert.equal(pause.ok, false);
  assert.equal(resume.ok, false);
  assert.match(pause.error, /No active recording/);
  assert.match(resume.error, /No active recording/);
  const session = (await h.dispatch({ type: "R2POM_GET_SESSION" })).session;
  assert.equal(session.recording, false);
  assert.equal(session.paused, false);
});

test("extension rejects unsupported and oversized event payloads", async () => {
  const h = await harness();
  await h.dispatch({ type: "R2POM_START", url: "https://example.test/" });
  const unsupported = await h.dispatch({ type: "R2POM_EVENT", event: { kind: "run-shell" } });
  assert.equal(unsupported.ok, false);
  assert.match(unsupported.error, /Unsupported event kind/);
  const oversized = await h.dispatch({ type: "R2POM_EVENT", event: { kind: "fill", value: "x".repeat(33000) } });
  assert.equal(oversized.ok, false);
  assert.match(oversized.error, /32 KB limit/);
  assert.equal((await h.dispatch({ type: "R2POM_GET_SESSION" })).session.events.length, 0);
});

test("extension strips sensitive values before persisting events", async () => {
  const h = await harness();
  await h.dispatch({ type: "R2POM_START", url: "https://example.test/login" });
  const result = await h.dispatch({
    type: "R2POM_EVENT",
    event: { kind: "fill", value: "secret-password", target: { inputType: "password", name: "userPassword" } }
  });
  assert.equal(result.ok, true);
  const stored = (await h.dispatch({ type: "R2POM_GET_SESSION" })).session.events[0];
  assert.equal("value" in stored, false);
  assert.equal(stored.redacted, true);
  assert.equal(stored.sensitivity, "sensitive");
  assert.equal(stored.envVar, "USERPASSWORD");
});

test("extension assigns monotonic sequence and session identity to captured events", async () => {
  const h = await harness();
  await h.dispatch({ type: "R2POM_START", url: "https://example.test/" });
  const first = { kind: "click", sequence: 99, sessionId: "untrusted" };
  const second = { kind: "navigate", url: "https://example.test/next" };
  await h.dispatch({ type: "R2POM_EVENT", event: first });
  await h.dispatch({ type: "R2POM_EVENT", event: second });
  const session = (await h.dispatch({ type: "R2POM_GET_SESSION" })).session;
  assert.equal(session.events[0].sequence, 1);
  assert.equal(session.events[1].sequence, 2);
  assert.equal(session.events[0].sessionId, session.sessionId);
  assert.equal(session.events[1].sessionId, session.sessionId);
});

test("extension rejects malformed and unknown messages without crashing", async () => {
  const h = await harness();
  assert.equal((await h.dispatch(null)).ok, false);
  assert.match((await h.dispatch({ type: "UNKNOWN" })).error, /Unknown message/);
});

test("navigation notification is sent only for completed HTTP(S) tabs while recording", async () => {
  const h = await harness();
  await h.installed[0]();
  const onUpdated = h.updates[0];
  await onUpdated(7, { status: "complete" }, { url: "chrome://settings" });
  assert.equal(h.sentTabMessages.length, 0);
  await onUpdated(7, { status: "loading" }, { url: "https://example.test/" });
  assert.equal(h.sentTabMessages.length, 0);
  await h.dispatch({ type: "R2POM_START", url: "https://example.test/" });
  await onUpdated(7, { status: "complete" }, { url: "https://example.test/next" });
  assert.equal(h.sentTabMessages.length, 1);
  assert.equal(h.sentTabMessages[0].tabId, 7);
  assert.equal(h.sentTabMessages[0].message.url, "https://example.test/next");
  await h.dispatch({ type: "R2POM_PAUSE" });
  await onUpdated(7, { status: "complete" }, { url: "https://example.test/paused" });
  assert.equal(h.sentTabMessages.length, 1);
});
