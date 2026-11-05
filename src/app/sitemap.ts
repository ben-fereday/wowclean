import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/book", "/contact", "/faq", "/our-story", "/privacy", "/terms"].map(
    (path) => ({ url: `https://wowcleancalgary.com${path}` }),
  );
}
