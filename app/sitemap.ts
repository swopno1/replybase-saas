import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://app.replybase.co.uk";
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://replybase.co.uk";

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
    {
      url: `${siteUrl}/pricing`,
      lastModified: new Date(),
    },
    {
      url: `${siteUrl}/terms`,
      lastModified: new Date(),
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified: new Date(),
    },
    {
      url: `${siteUrl}/faq`,
      lastModified: new Date(),
    },
  ];
}
