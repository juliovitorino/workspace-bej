import { StrictMode } from "react";
import "./i18n";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyTheme, getThemePreference } from "./theme";

// Set the effective theme before the first React paint.
applyTheme(getThemePreference());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
