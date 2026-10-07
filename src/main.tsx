import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyTheme, initialTheme } from "./themeRuntime";
// Fonts are bundled locally (SIL OFL 1.1): no request to a font CDN.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "./styles.css";
applyTheme(initialTheme());
// Start fetching the 3D engine now, in parallel with the session data, instead of after the
// lazy CircuitScene chunk asks for it.
void import("./components/circuit/DriverScene");
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
