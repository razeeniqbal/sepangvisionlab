// First-visit guide preference. Pure; storage is injected (same pattern as the theme).
export const GUIDE_KEY = "svl-guide-seen";

/** Whether the first-visit guide was dismissed for good. Storage is injected (theme pattern). */
export function guideSeen(storage: Pick<Storage, "getItem"> | null | undefined) {
  try {
    return storage?.getItem(GUIDE_KEY) === "1";
  } catch {
    return false;
  }
}
export function markGuideSeen(storage: Pick<Storage, "setItem"> | null | undefined) {
  try {
    storage?.setItem(GUIDE_KEY, "1");
  } catch {
    /* private mode: the guide simply shows again next visit */
  }
}
