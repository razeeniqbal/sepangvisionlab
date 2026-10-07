import { test } from "node:test";
import assert from "node:assert/strict";
import { buildShare, parseShare } from "../src/domain/share.ts";

test("share links round-trip and ignore bad values", () => {
  const url = buildShare("https://example.test", { slug: "race", time: 9697.6, driver: 3, camera: "chase" });
  assert.equal(url, "https://example.test/#s=race&t=9697&d=3&cam=chase");
  assert.deepEqual(parseShare(new URL(url).hash), { slug: "race", time: 9697, driver: 3, camera: "chase" });
  assert.deepEqual(parseShare("#s=monaco&t=-5&d=abc&cam=drone"), {});
  assert.deepEqual(parseShare(""), {});
  assert.deepEqual(parseShare("#t=0"), { time: 0 });
});
