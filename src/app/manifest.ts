import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Softdesk Chamados PWA",
    short_name: "Chamados",
    description: "Aplicacao PWA para analise operacional de chamados Softdesk.",
    start_url: "/",
    display: "standalone",
    background_color: "#eef3f8",
    theme_color: "#0f4fb4",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
      },
    ],
  };
}
