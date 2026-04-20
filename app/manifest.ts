import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hot Truck Maps",
    short_name: "Hot Truck",
    description: "Real-time food truck discovery. Find the food truck. Skip the guesswork.",
    start_url: "/",
    display: "standalone",
    background_color: "#171717",
    theme_color: "#E8481C",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
