// Build step, run by Bun after `vite build` (see the `build` script in package.json). It renders the
// guide to HTML and writes dist/guide/index.html, so the guide has its own title, description and
// canonical link, and its text is in the page before any script runs. The browser then hydrates it.
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { GuidePage } from "@/guide/GuidePage";
import { GuideDocument } from "@/guide/guideDocument";

const DIST = `${import.meta.dir}/../../dist`;

const indexHtml = await Bun.file(`${DIST}/index.html`).text();
// The same tree as in main.tsx, so the browser's first render matches this markup exactly.
const guideHtml = renderToString(
  <StrictMode>
    <GuidePage />
  </StrictMode>,
);
await Bun.write(`${DIST}/guide/index.html`, GuideDocument.build(indexHtml, guideHtml));
console.log("prerender: wrote dist/guide/index.html");
