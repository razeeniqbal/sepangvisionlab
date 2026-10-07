import { test } from "node:test";
import assert from "node:assert/strict";
import { GUIDE_KEY, guideSeen, markGuideSeen } from "../src/components/recorded/guideStorage.ts";

test("the quick guide shows until it is dismissed for good, and survives broken storage", () => {
  const store = new Map<string, string>();
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  assert.equal(guideSeen(storage), false, "first visit shows the guide");
  markGuideSeen(storage);
  assert.equal(store.get(GUIDE_KEY), "1");
  assert.equal(guideSeen(storage), true);
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.equal(guideSeen(broken), false);
  assert.doesNotThrow(() => markGuideSeen(broken));
  assert.equal(guideSeen(null), false);
});
