import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "@/App";
import { GuidePage } from "@/guide/GuidePage";
import { PrerenderMark } from "@/guide/prerenderMark";
import { Analytics } from "@/lib/analytics";
import "@/index.css";

Analytics.init();

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

// Tiny path-based routing: /guide renders the standalone guide, everything else the editor. No
// router dependency. The build writes the guide, already rendered, to dist/guide/index.html and the
// static server returns it for /guide. React hydrates that markup: it keeps the HTML and attaches
// its handlers. Any other root holds only the home page's static fallback, which React replaces.
const prerendered = PrerenderMark.isOn(root);
const isGuide = prerendered || window.location.pathname.replace(/\/+$/, "") === "/guide";
const page = <StrictMode>{isGuide ? <GuidePage /> : <App />}</StrictMode>;

if (prerendered) hydrateRoot(root, page);
else createRoot(root).render(page);
