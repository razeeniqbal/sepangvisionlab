import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ACCENTS, THEME_KEY, nextTheme, readTheme, writeTheme,
} from "../src/theme.ts";

test("theme defaults to SVL and survives broken or hostile storage", () => {
  assert.equal(readTheme(undefined), "svl");
  assert.equal(readTheme({ getItem: () => null }), "svl");
  assert.equal(readTheme({ getItem: () => "neon" }), "svl");
  assert.equal(readTheme({ getItem: () => "broadcast" }), "broadcast");
  assert.equal(readTheme({ getItem: () => { throw new Error("SecurityError"); } }), "svl");
});

test("saving reports failure instead of throwing", () => {
  const saved = new Map<string, string>();
  assert.equal(writeTheme({ setItem: (k, v) => void saved.set(k, v) }, "broadcast"), true);
  assert.equal(saved.get(THEME_KEY), "broadcast");
  assert.equal(writeTheme({ setItem: () => { throw new Error("QuotaExceeded"); } }, "svl"), false);
  assert.equal(writeTheme(null, "svl"), false);
  assert.equal(nextTheme("svl"), "broadcast");
  assert.equal(nextTheme("broadcast"), "svl");
});

// ---- contrast: read the real token values from styles.css ----
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
function block(selector: string) {
  const start = css.indexOf(selector + " {");
  assert.ok(start >= 0, selector);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}
const svl = block(":root");
const broadcast = { ...svl, ...block(':root[data-theme="broadcast"]') };
function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test("small text keeps at least 4.5:1 in both themes", () => {
  for (const [name, t] of [["svl", svl], ["broadcast", broadcast]] as const) {
    const pairs: [string, string, string][] = [
      ["#ffffff", t["accent-fill"], "white on accent fill"],
      [t["accent-text"], t["panel-solid"], "accent text on panel"],
      [t["muted"], t["panel-solid"], "muted on panel"],
      [t["silver"], t["panel-solid"], "silver on panel"],
      [t["best-session"], t["panel-solid"], "session best"],
      [t["best-personal"], t["panel-solid"], "personal best"],
      [t["warn"], t["panel-solid"], "flags"],
    ];
    for (const [fg, bg, label] of pairs) {
      assert.ok(fg && bg, `${name}: token missing for ${label}`);
      assert.ok(contrast(fg, bg) >= 4.5, `${name} ${label}: ${contrast(fg, bg).toFixed(2)}`);
    }
  }
});

test("3D accents match the CSS accent of each theme", () => {
  assert.equal(svl["accent"].toLowerCase(), ACCENTS.svl);
  assert.equal(broadcast["accent"].toLowerCase(), ACCENTS.broadcast);
});
