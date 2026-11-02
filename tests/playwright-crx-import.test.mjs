import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

test("Playwright CRX script adapter converts common codegen actions into Record2POM events",async()=>{
 const source=await readFile("playwright-crx-import.js","utf8"),window={};
 vm.runInNewContext(source,{window,globalThis:window,document:undefined,Error,String,RegExp,Array,Object});
 const parsed=window.Record2POMCrxImporter.parse(`
await page.goto('https://fixture.test/login');
await page.getByLabel('Work email').fill('qa@example.test');
await page.getByPlaceholder("Password").fill("not-stored");
await page.getByRole('button', { name: 'Sign in', exact: true }).click();
await expect(page.getByText('Dashboard')).toBeVisible();
await expect(page).toHaveURL('/dashboard');
`);
 assert.equal(parsed.targetUrl,"https://fixture.test/login");
 assert.deepEqual(Array.from(parsed.events,e=>e.kind),["navigate","fill","fill","click","assert-visible","assert-url"]);
 assert.equal(parsed.events[1].locators[0].strategy,"label");
 assert.equal(parsed.events[3].locators[0].strategy,"role");
 assert.equal(parsed.events[3].locators[0].name,"Sign in");
 assert.equal(parsed.events[2].redacted,true);
 assert.equal("value" in parsed.events[2],false);
 assert.equal(parsed.events[4].locators[0].strategy,"text");\n assert.equal(parsed.events[4].target.text,"Dashboard");
});
