import type { CarDefinition, TyreCompound } from "../domain/field.ts";
import { LAP_SECONDS } from "../domain/movement.ts";
import { brand } from "./brand";

const numbers = [
  "07",
  "88",
  "12",
  "24",
  "31",
  "44",
  "55",
  "63",
  "16",
  "27",
  "81",
  "03",
  "19",
  "22",
  "36",
  "48",
  "52",
  "69",
  "75",
  "90",
];
const colors = [
  brand.primary,
  "#efaa58",
  "#afbad0",
  "#a68ed4",
  "#8299be",
  "#b9b6a0",
  "#ba817b",
  "#99ad86",
  "#929fae",
  "#c99aaf",
];
const compounds: TyreCompound[] = ["MEDIUM", "SOFT", "HARD"];
// Fictional entries, not real teams or a historical grid. Stable seeds make Reset reproducible.
export const syntheticCars: readonly CarDefinition[] = numbers.map(
  (number, index) => ({
    id: "car-" + number,
    number,
    color: colors[index % colors.length],
    initialProgress: index === 0 ? 0 : index === 1 ? 0.012 : index / 20,
    lapSeconds: index === 0 ? LAP_SECONDS : 22.4 + ((index * 7) % 20) * 0.22,
    compound: compounds[index % compounds.length],
    initialTyreAge: (index * 3) % 12,
  }),
);
