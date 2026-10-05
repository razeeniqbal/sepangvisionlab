export function Chevron({
  collapsed,
  label,
  onToggle,
}: {
  collapsed: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="bc-chevron"
      aria-expanded={!collapsed}
      aria-label={(collapsed ? "Expand " : "Collapse ") + label}
      onClick={onToggle}
    >
      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
        <path d={collapsed ? "M2 4.5 6 8.5 10 4.5" : "M2 7.5 6 3.5 10 7.5"} />
      </svg>
    </button>
  );
}
