// Remove files from the build output that the app never loads at runtime, so static
// deployments stay small. The source files themselves are not touched.
import { rmSync, existsSync } from "node:fs";

const unused = [
  // 28 MB authoring model; the app loads svl-formula-car-runtime-v1.glb (formulaAssets.ts).
  "dist/assets/models/cars/svl-formula-car-v1.glb",
];
for (const file of unused) {
  if (existsSync(file)) {
    rmSync(file);
    console.log(`pruned ${file}`);
  }
}
