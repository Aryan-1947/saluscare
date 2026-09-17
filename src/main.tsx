import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AppAuth0Provider } from "@/lib/auth0-provider";

const storedTheme = localStorage.getItem("salus-theme");
const isDark = storedTheme !== "light";
document.documentElement.classList.toggle("dark", isDark);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppAuth0Provider>
      <App />
    </AppAuth0Provider>
  </StrictMode>
);