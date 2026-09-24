export default function WorkspaceNav({ historical }: { historical: boolean }) {
  const links = [
    ["race-view", "Circuit"],
    ["race-replay", "Replay"],
    ["race-analysis", historical ? "Lap analysis" : "Telemetry"],
    ...(historical ? [["race-strategy", "Strategy Lab"]] : []),
    ["hand-lab", "Hand tracking"],
  ];
  return (
    <nav className="workspace-nav" aria-label="Workspace sections">
      <span>WORKSPACE</span>
      {links.map(([id, label]) => (
        <a key={id} href={"#" + id}>
          {label}
        </a>
      ))}
    </nav>
  );
}
