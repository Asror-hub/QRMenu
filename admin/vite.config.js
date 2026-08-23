import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import os from "node:os";

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

// Dev-only endpoint so the app can build a phone-scannable URL using the
// machine's LAN IP instead of localhost. Returns { ip: "192.168.x.x" | null }.
function lanIpPlugin() {
  return {
    name: "lan-ip-endpoint",
    configureServer(server) {
      server.middlewares.use("/__lan-ip", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ip: getLanIp() }));
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), lanIpPlugin()],
  server: {
    host: true,
    port: 5173
  }
});
