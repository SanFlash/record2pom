import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const assets = [
  "readme-motion-grid.svg",
  "readme-motion-pipeline.svg",
  "readme-motion-orbit.svg",
];

test("README links every animated motion asset", () => {
  for (const asset of assets) {
    assert.match(readme, new RegExp("assets/" + asset.replaceAll(".", "\\.")));
  }
});

for (const asset of assets) {
  test(`${asset} has accessible SVG metadata and animation`, () => {
    const svg = readFileSync(new URL("../assets/" + asset, import.meta.url), "utf8");
    assert.match(svg, /^<svg\\s/);
    assert.match(svg, /<title\\b[^>]*>[^<]+<\\/title>/);
    assert.match(svg, /<desc\\b[^>]*>[^<]+<\\/desc>/);
    assert.match(svg, /viewBox="0 0 [\\d.]+ [\\d.]+"/);
    assert.match(svg, /<animate(?:Motion|Transform)?\\b/);
    assert.match(svg, /<\\/svg>\\s*$/);
    assert.doesNotMatch(svg, /<script\\b/i, "README SVGs must not contain scripts");
  });
}
