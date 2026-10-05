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
  texture.anisotropy = 4;
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

/** Fine asphalt grain, repeated every 10 m. */
export const asphaltTexture = () =>
  canvasTexture(128, 128, (c) => {
    c.fillStyle = "#3a3e40";
    c.fillRect(0, 0, 128, 128);
    let seed = 7;
    for (let i = 0; i < 2200; i++) {
      seed = (seed * 16807) % 2147483647;
      const shade = 46 + (seed % 26);
      c.fillStyle = `rgb(${shade},${shade + 2},${shade + 4})`;
      c.fillRect(seed % 128, (seed >> 7) % 128, 1, 1);
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
