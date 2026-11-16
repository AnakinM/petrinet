// Production static server for the built SPA. Pure Bun, no framework.
// Serves files from ./dist and falls back to index.html for client-side routes.

const DIST = `${import.meta.dir}/dist`;
const PORT = Number(Bun.env.PORT ?? 3000);
const indexHtml = Bun.file(`${DIST}/index.html`);

/**
 * The file in dist for a request path, or null. A directory that holds an index.html serves that
 * file, with or without a trailing slash: / is dist/index.html and /guide is dist/guide/index.html.
 * `exists()` is false for a directory itself. URL parsing has already removed every `..` segment,
 * so a path cannot leave dist.
 */
async function distFile(pathname: string): Promise<Bun.BunFile | null> {
  // Trim trailing slashes with a loop. The regex /\/+$/ takes quadratic time on a path of many
  // slashes followed by a letter, which a visitor controls. There is no test seam: this file starts
  // the server when it loads.
  let end = pathname.length;
  while (end > 0 && pathname[end - 1] === "/") end--;
  for (const path of [pathname, `${pathname.slice(0, end)}/index.html`]) {
    const file = Bun.file(`${DIST}${path}`);
    if (await file.exists()) return file;
  }
  return null;
}

const server = Bun.serve({
  port: PORT,
  async fetch(req): Promise<Response> {
    const file = await distFile(new URL(req.url).pathname);
    if (file) return new Response(file);
    return new Response(indexHtml, { headers: { "Content-Type": "text/html" } });
  },
});

console.log(`petrinet serving on http://localhost:${server.port}`);
