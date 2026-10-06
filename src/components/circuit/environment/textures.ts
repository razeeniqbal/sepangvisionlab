import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";

// Small canvas textures generated at load; no image assets or licences involved.
function canvasTexture(
  width: number,
  height: number,
  draw: (c: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context) draw(context);
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** One red and one white block per repeat along u. */
export const kerbTexture = () =>
  canvasTexture(64, 8, (c) => {
    c.fillStyle = "#c8233a";
    c.fillRect(0, 0, 32, 8);
    c.fillStyle = "#f1f1ec";
    c.fillRect(32, 0, 32, 8);
  });

// Deterministic value noise for the ground textures (same look on every load).
function noise(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/**
 * Asphalt, repeated every 10 m: two scales of aggregate grain plus faint rubber streaks
 * running along the direction of travel (texture x = along the track).
 */
export const asphaltTexture = () =>
  canvasTexture(256, 256, (c) => {
    const rand = noise(7);
    c.fillStyle = "#3a3e41";
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 90; i++) {
      const shade = 52 + Math.floor(rand() * 16);
      c.fillStyle = `rgba(${shade},${shade + 2},${shade + 5},0.35)`;
      c.beginPath();
      c.arc(rand() * 256, rand() * 256, 6 + rand() * 22, 0, Math.PI * 2);
      c.fill();
    }
    for (let i = 0; i < 9000; i++) {
      const shade = 38 + Math.floor(rand() * 40);
      c.fillStyle = `rgb(${shade},${shade + 2},${shade + 4})`;
      c.fillRect(Math.floor(rand() * 256), Math.floor(rand() * 256), 1, 1);
    }
    for (let i = 0; i < 26; i++) {
      c.fillStyle = `rgba(18,19,20,${0.03 + rand() * 0.05})`;
      c.fillRect(0, Math.floor(rand() * 256), 256, 1 + Math.floor(rand() * 3));
    }
  });

/** Mown grass: mottled greens with broad mowing stripes; repeated every 24 m on the ground. */
export const grassTexture = () =>
  canvasTexture(256, 256, (c) => {
    const rand = noise(23);
    c.fillStyle = "#5b7047";
    c.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 64) {
      c.fillStyle = "rgba(255,255,230,0.035)";
      c.fillRect(x, 0, 32, 256);
    }
    for (let i = 0; i < 220; i++) {
      const g = rand();
      c.fillStyle = g > 0.5 ? `rgba(104,122,74,${0.05 + rand() * 0.07})` : `rgba(66,82,48,${0.05 + rand() * 0.07})`;
      c.beginPath();
      c.arc(rand() * 256, rand() * 256, 3 + rand() * 10, 0, Math.PI * 2);
      c.fill();
    }
    for (let i = 0; i < 12000; i++) {
      const g = 80 + Math.floor(rand() * 45);
      c.fillStyle = `rgba(${Math.floor(g * 0.7)},${g},${Math.floor(g * 0.52)},0.4)`;
      c.fillRect(Math.floor(rand() * 256), Math.floor(rand() * 256), 1, 2);
    }
  });

/**
 * Guardrail over a low concrete wall, repeated every 10 m along the barrier strip (x along,
 * y up): two galvanised rails on the upper half, a post every 2.5 m, weathered concrete below.
 */
export const barrierTexture = () =>
  canvasTexture(256, 64, (c) => {
    const rand = noise(5);
    c.fillStyle = "#b9bcb6";
    c.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 1400; i++) {
      const l = 160 + Math.floor(rand() * 50);
      c.fillStyle = `rgba(${l},${l},${l - 6},0.5)`;
      c.fillRect(Math.floor(rand() * 256), 34 + Math.floor(rand() * 30), 1, 1);
    }
    c.fillStyle = "#7f878a";
    for (let x = 0; x < 256; x += 64) c.fillRect(x + 30, 0, 5, 34);
    for (const y of [4, 18]) {
      const g = c.createLinearGradient(0, y, 0, y + 10);
      g.addColorStop(0, "#e1e5e6");
      g.addColorStop(0.5, "#a9b0b3");
      g.addColorStop(1, "#6d7477");
      c.fillStyle = g;
      c.fillRect(0, y, 256, 10);
    }
  });

/** Gravel trap: pale stones of mixed size. */
export const gravelTexture = () =>
  canvasTexture(128, 128, (c) => {
    const rand = noise(41);
    c.fillStyle = "#c4a46f";
    c.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 4200; i++) {
      const l = 150 + Math.floor(rand() * 80);
      c.fillStyle = `rgb(${l},${Math.floor(l * 0.84)},${Math.floor(l * 0.6)})`;
      const r = rand() < 0.15 ? 2 : 1;
      c.fillRect(Math.floor(rand() * 128), Math.floor(rand() * 128), r, r);
    }
  });

/** Plain white-on-black chevron for corner boards (no numbers: see register env-corner-boards). */
export const chevronTexture = () =>
  canvasTexture(64, 64, (c) => {
    c.fillStyle = "#121617";
    c.fillRect(0, 0, 64, 64);
    c.strokeStyle = "#f1f1ec";
    c.lineWidth = 9;
    c.beginPath();
    c.moveTo(22, 12);
    c.lineTo(42, 32);
    c.lineTo(22, 52);
    c.stroke();
  });

/** Turn board: official turn number over a chevron pointing the way the corner goes. */
export const turnBoardTexture = (turn: number, left: boolean) =>
  canvasTexture(128, 160, (c) => {
    c.fillStyle = "#121617";
    c.fillRect(0, 0, 128, 160);
    c.strokeStyle = "#00a19c";
    c.lineWidth = 6;
    c.strokeRect(3, 3, 122, 154);
    c.fillStyle = "#f1f1ec";
    c.font = "700 64px 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("T" + turn, 64, 52);
    c.strokeStyle = "#f1f1ec";
    c.lineWidth = 12;
    c.beginPath();
    const dir = left ? -1 : 1;
    c.moveTo(64 - dir * 20, 98);
    c.lineTo(64 + dir * 14, 122);
    c.lineTo(64 - dir * 20, 146);
    c.stroke();
  });

/** Stadium seats: a mosaic of generic seat colours, no pattern, text or sponsor mark. */
export const seatTexture = () => {
  const texture = canvasTexture(64, 32, (c) => {
    const colours = ["#2f5f8a", "#3a6fa0", "#c9cfd2", "#b23a3a", "#2b8a83", "#d8b245", "#24486b"];
    let seed = 11;
    for (let y = 0; y < 32; y += 4)
      for (let x = 0; x < 64; x += 4) {
        seed = (seed * 16807) % 2147483647;
        c.fillStyle = colours[seed % colours.length];
        c.fillRect(x, y, 4, 3);
      }
  });
  texture.repeat.set(24, 2);
  return texture;
};
