import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://app.replybase.co.uk";

  return [
    {
      url: `${appUrl}/`,
      lastModified: new Date(),
    },
    {
      url: `${appUrl}/auth/login`,
      lastModified: new Date(),
    },
    {
      url: `${appUrl}/auth/register`,
      lastModified: new Date(),
    },
  ];
}
