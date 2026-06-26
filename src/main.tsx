import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import { Analytics } from "@/lib/analytics";
import "@/index.css";

Analytics.init();

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
