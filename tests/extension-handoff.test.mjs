import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const KEY = "record2pom_session_v1";

test("Studio handoff recovers when the tab is already complete before the listener is attached", async () => {
  const session = {
    schemaVersion: 1,
    sessionId: "session-handoff-test",
    recording: false,
    paused: false,
    targetUrl: "https://fixture.test/",
    targetTabId: 7,
    startedAt: "2026-10-29T08:00:00.000Z",
    stoppedAt: "2026-10-29T08:00:10.000Z",
    events: [{ kind: "click", sequence: 1, target: { role: "button", name: "Continue" } }]
  };
  const store = { [KEY]: session };
  const messageListeners = [];
  const updatedListeners = [];
  const injections = [];
  let nextTabId = 99;

  const chrome = {
    runtime: {
      onInstalled: { addListener() {} },
      getManifest() { return {version:"0.2.1"}; },
      onMessage: { addListener(fn) { messageListeners.push(fn); } }
    },
    storage: {
      local: {
        async get(key) { return { [key]: store[key] }; },
        async set(values) { Object.assign(store, values); }
      }
    },
    tabs: {
      onUpdated: {
        addListener(fn) { updatedListeners.push(fn); },
        removeListener(fn) {
          const index = updatedListeners.indexOf(fn);
          if (index >= 0) updatedListeners.splice(index, 1);
        }
      },
      async create() {
        // Simulate a very fast load: the tab is complete before create resolves.
        return { id: nextTabId, status: "complete", url: "https://record2pom.vercel.app/" };
      },
      async get(id) {
        assert.equal(id, nextTabId);
        return { id, status: "complete", url: "https://record2pom.vercel.app/" };
      },
      async update() {},
      async sendMessage() {}
    },
    scripting: {
      async executeScript(args) {
        injections.push(args);
        return [{}];
      }
    }
  };

  vm.runInNewContext(await readFile("extension/background.js", "utf8"), {
    chrome, Date, Error, console, URL, URLSearchParams, JSON, String, RegExp, Number
  });

  const dispatch = (message) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Background message timed out")), 1000);
    const keepAlive = messageListeners[0](message, { tab: { id: 7, url: "https://fixture.test/" } }, (response) => {
      clearTimeout(timeout);
      resolve(response);
    });
    assert.equal(keepAlive, true);
  });

  const result = await dispatch({ type: "R2POM_GENERATE_POM" });
  assert.equal(result.ok, true);
  assert.equal(result.tabId, nextTabId);

  // Delivery is asynchronous after the acknowledgement; let its promise settle.
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(injections.length, 1, "already-complete Studio tab must receive the recording");
  assert.equal(injections[0].target.tabId, nextTabId);
  assert.equal(injections[0].args[0].metadata.sessionId, session.sessionId);
  assert.equal(injections[0].args[0].metadata.recorderVersion, "0.2.1");
  assert.equal(injections[0].args[0].events.length, 1);
  assert.equal(store.record2pom_import_status_v1.ok, null);

  // Repeated completion events must not deliver the same recording twice.
  for (const listener of [...updatedListeners]) {
    await listener(nextTabId, { status: "complete" }, { id: nextTabId, url: "https://record2pom.vercel.app/" });
  }
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(injections.length, 1, "handoff must be idempotent after successful delivery");
});

test("Studio handoff rejects empty sessions and sessions that are still recording", async () => {
  const listeners = [];
  const session = { schemaVersion: 1, sessionId: "empty", recording: true, paused: false, targetUrl: "", events: [] };
  const chrome = {
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: { addListener(fn) { listeners.push(fn); } }
    },
    storage: { local: { async get(key) { return { [key]: session }; }, async set() {} } },
    tabs: { onUpdated: { addListener() {}, removeListener() {} }, async create() { throw new Error("must not open Studio"); } },
    scripting: { async executeScript() {} }
  };
  vm.runInNewContext(await readFile("extension/background.js", "utf8"), {
    chrome, Date, Error, console, URL, URLSearchParams, JSON, String, RegExp, Number
  });
  const dispatch = (message) => new Promise((resolve) => {
    listeners[0](message, { tab: { id: 7, url: "https://fixture.test/" } }, resolve);
  });
  const result = await dispatch({ type: "R2POM_GENERATE_POM" });
  assert.equal(result.ok, false);
  assert.match(result.error, /Stop the recording/);
});
