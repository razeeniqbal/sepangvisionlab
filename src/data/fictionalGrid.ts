// Fictional broadcast identities for the simulated session. Invented names and generic
// teams with plain geometric glyphs: no real drivers, teams, sponsors or logos.
export type TeamGlyph =
  "circle" | "square" | "triangle" | "diamond" | "hexagon";
export interface FictionalTeam {
  name: string;
  glyph: TeamGlyph;
  filled: boolean;
}
export interface FictionalDriver {
  code: string;
  name: string;
  team: FictionalTeam;
}

// Team index follows the entry's colour slot (entry index % 10), so team-mates share a colour.
const TEAMS: readonly FictionalTeam[] = [
  { name: "SVL Development", glyph: "circle", filled: true },
  { name: "Meridian", glyph: "square", filled: true },
  { name: "Halcyon", glyph: "triangle", filled: true },
  { name: "Kestrel", glyph: "diamond", filled: true },
  { name: "Northwind", glyph: "hexagon", filled: true },
  { name: "Lumen", glyph: "circle", filled: false },
  { name: "Basalt", glyph: "square", filled: false },
  { name: "Corvid", glyph: "triangle", filled: false },
  { name: "Tessera", glyph: "diamond", filled: false },
  { name: "Quartz", glyph: "hexagon", filled: false },
];

const DRIVERS: readonly (readonly [string, string])[] = [
  ["SVL", "SVL test driver"],
  ["TVA", "Teo Varga"],
  ["HAK", "Noor Hakim"],
  ["ARD", "Felix Ardent"],
  ["MOR", "Kaito Morrow"],
  ["BRK", "Elena Brask"],
  ["OKA", "Samir Okafor"],
  ["WEX", "Jonah Wexley"],
  ["DOR", "Priya Dorai"],
  ["FRD", "Luca Ferrand"],
  ["CAL", "Ines Calder"],
  ["QUI", "Rafe Quinlan"],
  ["SEL", "Aya Selwyn"],
  ["TOR", "Malik Torvald"],
  ["BRI", "Hana Brightwater"],
  ["VEL", "Oskar Velin"],
  ["KIP", "Zara Kiplagat"],
  ["ASH", "Dmitri Asher"],
  ["ODU", "Ren Oduya"],
  ["MAR", "Cole Marchetti"],
];

/** Identity by entry index; entries beyond the list fall back to their car number. */
export function fictionalDriver(
  index: number,
  number: string,
): FictionalDriver {
  const [code, name] = DRIVERS[index] ?? ["#" + number, "Car " + number];
  return { code, name, team: TEAMS[index % TEAMS.length] };
}
