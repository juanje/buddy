import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [
    svelte(),
    {
      // Dev-only: the Tauri webview has no visible console, so the frontend
      // POSTs diagnostics to /__ab_log and they show up in the terminal.
      name: "ab-dev-log",
      configureServer(server) {
        server.middlewares.use("/__ab_log", (req, res) => {
          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", () => {
            console.log(`[webview] ${body}`);
            res.end("ok");
          });
        });
        // Dev-only remote control: POST a command here and it is forwarded to
        // the webview over the Vite HMR websocket (see src/utils/dev-log.ts).
        // Lets us drive the real app headlessly for smoke tests.
        server.middlewares.use("/__ab_cmd", (req, res) => {
          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", () => {
            server.ws.send({ type: "custom", event: "ab:cmd", data: body });
            res.end("ok");
          });
        });
      },
    },
  ],
  define: {
    // Absolute project root, baked in at build time. The Tauri process runs
    // with cwd src-tauri/, so the worker spawn needs an absolute cwd to find
    // backends/ and node_modules (dev mode; production will bundle the worker).
    __AB_PROJECT_ROOT__: JSON.stringify(process.cwd()),
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: "es2022",
  },
});
