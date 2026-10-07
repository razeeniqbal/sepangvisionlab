import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Button with a glass popover; closes on outside click or Escape and returns focus. */
export default function Popover({
  label,
  button,
  children,
  align = "end",
  placement = "bottom",
  className = "",
  closeOnAction = false,
}: {
  /** Close when a button inside is pressed (menus); off for panels with several settings. */
  closeOnAction?: boolean;
  label: string;
  button: ReactNode;
  children: ReactNode;
  align?: "start" | "end" | "center";
  placement?: "top" | "bottom";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className={"sv-popover " + className} ref={root}>
      <button
        ref={trigger}
        type="button"
        className="sv-icon-button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {button}
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className={`sv-popover-panel glass is-${align} is-${placement}`}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (closeOnAction && target.closest("button[data-closes]")) setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
