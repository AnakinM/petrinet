import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import { GuidePage } from "@/guide/GuidePage";
import { Analytics } from "@/lib/analytics";
import "@/index.css";

Analytics.init();

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

// Tiny path-based routing: /guide renders the standalone guide, everything else the editor. No
// router dependency — the static server falls back to index.html, so the SPA boots and picks here.
const isGuide = window.location.pathname.replace(/\/+$/, "") === "/guide";

createRoot(root).render(<StrictMode>{isGuide ? <GuidePage /> : <App />}</StrictMode>);
