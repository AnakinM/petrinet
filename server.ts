// Production static server for the built SPA. Pure Bun, no framework.
// Serves files from ./dist and falls back to index.html for client-side routes.

const DIST = `${import.meta.dir}/dist`;
const PORT = Number(Bun.env.PORT ?? 3000);
const indexHtml = Bun.file(`${DIST}/index.html`);

const server = Bun.serve({
  port: PORT,
  async fetch(req): Promise<Response> {
    const { pathname } = new URL(req.url);
    const file = Bun.file(`${DIST}${pathname === "/" ? "/index.html" : pathname}`);
    if (await file.exists()) {
      return new Response(file);
    }
    return new Response(indexHtml, { headers: { "Content-Type": "text/html" } });
  },
});

console.log(`petrinet serving on http://localhost:${server.port}`);
