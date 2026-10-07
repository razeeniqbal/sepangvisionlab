// Shareable links: the session, replay time, followed driver and camera in the URL hash, e.g.
// #s=race&t=9697&d=3&cam=chase. Pure; values are validated, unknown ones ignored.

export interface ShareState {
  slug?: string;
  /** Replay time in whole seconds. */
  time?: number;
  driver?: number;
  camera?: string;
}

const SLUGS = ["fp1", "fp2", "fp3", "qualifying", "race"];
const CAMERAS = ["tv", "chase", "onboard", "heli", "inspect"];

export function parseShare(hash: string): ShareState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const out: ShareState = {};
  const s = params.get("s");
  if (s && SLUGS.includes(s)) out.slug = s;
  const t = Number(params.get("t"));
  if (params.has("t") && Number.isFinite(t) && t >= 0 && t < 24 * 3600) out.time = Math.floor(t);
  const d = Number(params.get("d"));
  if (params.has("d") && Number.isInteger(d) && d > 0 && d < 100) out.driver = d;
  const cam = params.get("cam");
  if (cam && CAMERAS.includes(cam)) out.camera = cam;
  return out;
}

export function buildShare(origin: string, state: Required<ShareState>) {
  const params = new URLSearchParams({
    s: state.slug,
    t: String(Math.floor(state.time)),
    d: String(state.driver),
    cam: state.camera,
  });
  return `${origin}/#${params.toString()}`;
}
