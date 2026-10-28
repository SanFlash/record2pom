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
    assert.ok(readme.includes("assets/" + asset), "README should reference " + asset);
  }
});

for (const asset of assets) {
  test(asset + " has accessible SVG metadata and animation", () => {
    const svg = readFileSync(new URL("../assets/" + asset, import.meta.url), "utf8");
    assert.ok(svg.trimStart().startsWith("<svg "), "SVG root element is missing");
    assert.ok(svg.includes("<title"), "Accessible title is missing");
    assert.ok(svg.includes("<desc"), "Accessible description is missing");
    assert.ok(svg.includes('viewBox="0 0 '), "Responsive viewBox is missing");
    assert.ok(svg.includes("<animate"), "Expected at least one SVG animation");
    assert.ok(svg.trimEnd().endsWith("</svg>"), "SVG closing tag is missing");
    assert.ok(!svg.includes("<script"), "SVG assets must not contain scripts");
  });
}
