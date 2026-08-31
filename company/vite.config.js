import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function seoFilesPlugin(siteUrl) {
  const site = String(siteUrl || "").replace(/\/$/, "");
  return {
    name: "qrmenu-seo-files",
    transformIndexHtml(html) {
      if (site) return html.replaceAll("__SITE_URL__", site);
      return html
        .replace('<link rel="canonical" href="__SITE_URL__/" />', "")
        .replace('<meta property="og:url" content="__SITE_URL__/" />', "")
        .replaceAll('content="__SITE_URL__/og.svg"', 'content="/og.svg"');
    },
    generateBundle() {
      if (!site) return;
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${site}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${site}/privacy.html</loc>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>
`,
      });
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), seoFilesPlugin(env.VITE_PUBLIC_SITE_URL)],
  };
});
