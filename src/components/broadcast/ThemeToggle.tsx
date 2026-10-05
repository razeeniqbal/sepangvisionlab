import { THEMES, THEME_LABELS } from "../../theme";
import { applyTheme, useTheme } from "../../themeRuntime";

/** Interface theme switch; the choice is remembered in this browser (localStorage). */
export default function ThemeToggle() {
  const theme = useTheme();
  return (
    <div className="theme-toggle" role="group" aria-label="Interface theme">
      {THEMES.map((t) => (
        <button
          key={t}
          aria-pressed={theme === t}
          onClick={() => applyTheme(t, true)}
        >
          {THEME_LABELS[t]}
        </button>
      ))}
    </div>
  );
}
