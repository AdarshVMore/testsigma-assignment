import path from "node:path";
import index from "./src/index.html";

const REPO_ROOT = path.resolve(import.meta.dir, "../");
const SNAPSHOT_PATH = path.join(import.meta.dir, "data/snapshot.json");

const server = Bun.serve({
  port: 4300,
  routes: {
    "/": index,

    "/api/snapshot": async () => {
      const file = Bun.file(SNAPSHOT_PATH);
      if (!(await file.exists())) {
        return Response.json(
          { error: "snapshot.json not found — run `bun run web:collect` first" },
          { status: 404 },
        );
      }
      return new Response(file, { headers: { "content-type": "application/json" } });
    },

    // Serves the real screenshots/images/logs straight from examples/**
    // on disk — no copying into web/public, always reflects the latest
    // `bun run demo:*` output. Restricted to examples/ as a basic guard
    // against arbitrary file reads.
    "/media/*": async (req) => {
      const url = new URL(req.url);
      const relative = decodeURIComponent(url.pathname.replace(/^\/media\//, ""));
      if (!relative.startsWith("examples/") || relative.includes("..")) {
        return new Response("Not found", { status: 404 });
      }
      const file = Bun.file(path.join(REPO_ROOT, relative));
      if (!(await file.exists())) {
        return new Response("Not found", { status: 404 });
      }
      return new Response(file);
    },
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Workbench running at ${server.url}`);
