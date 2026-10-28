import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../showcase/index.html", import.meta.url), "utf8");
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter((script) => script.trim());

test("Motion Lab inline JavaScript parses", () => {
  assert.ok(inlineScripts.length > 0, "Expected a non-empty inline motion script");
  for (const script of inlineScripts) {
    assert.doesNotThrow(() => new vm.Script(script), "Inline showcase script must be valid JavaScript");
  }
});

test("Motion Lab preserves accessible reduced-motion and GSAP fallbacks", () => {
  assert.match(html, /prefers-reduced-motion:\s*reduce/i);
  assert.match(html, /const reduced\s*=\s*window\.matchMedia/);
  assert.match(html, /if\s*\(!window\.gsap\s*\|\|\s*reduced\)/);
  assert.match(html, /reveal\.forEach\(el\s*=>\s*\{\s*el\.style\.opacity\s*=\s*"1"/);
});

test("Motion Lab includes responsive and interactive motion hooks", () => {
  assert.match(html, /@media\s*\(max-width/i);
  assert.match(html, /scrollProgress/);
  assert.match(html, /IntersectionObserver/);
  assert.match(html, /pointermove/);
  assert.match(html, /tickerTween\.pause\(\)/);
  assert.match(html, /tickerTween\.resume\(\)/);
  assert.match(html, /ScrollTrigger\.min\.js/);
  assert.match(html, /scrollTrigger:\s*\{/);
  assert.match(html, /visibilitychange/);
  assert.match(html, /requestAnimationFrame/);
  assert.match(html, /id="particleField"/);
  assert.match(html, /gsap\.ticker\.add\(drawParticles\)/);
  assert.match(html, /class="scan-ring"/);
  assert.match(html, /class="satellite s1"/);
  assert.match(html, /gsap\.to\("\.gradient"/);
  assert.match(html, /feature-icon/);
  assert.match(html, /\.particle-field\{display:none!important\}/);
});
