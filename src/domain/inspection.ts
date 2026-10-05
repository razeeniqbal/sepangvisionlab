// Lap time formatting (m:ss.mmm); null shows as a dash.
export function formatLap(seconds: number | null): string {
  if (seconds === null) return "—";
  const milliseconds = Math.round(seconds * 1000);
  const minutes = Math.floor(milliseconds / 60000);
  return (
    minutes +
    ":" +
    String(Math.floor(milliseconds / 1000) % 60).padStart(2, "0") +
    "." +
    String(milliseconds % 1000).padStart(3, "0")
  );
}
