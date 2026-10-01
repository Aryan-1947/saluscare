import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { AppAuth0Provider } from "@/lib/auth0-provider";
import { resolveInitialTheme, applyThemeClass } from "@/stores/themeStore";

// Apply the theme class before React mounts: an explicit stored choice wins,
// otherwise the OS preference decides. Doing this pre-paint avoids a
// wrong-theme flash on first load.
applyThemeClass(resolveInitialTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AppAuth0Provider>
        <App />
      </AppAuth0Provider>
    </BrowserRouter>
  </StrictMode>
);
