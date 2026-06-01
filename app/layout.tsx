import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AnalyticsScripts } from "@/components/analytics/analytics-scripts";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.replybase.co.uk";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "ReplyBase",
    template: "%s | ReplyBase",
  },
  description:
    "Capture every lead, reply instantly, and manage your conversations—all in one simple platform.",
  applicationName: "ReplyBase",
  keywords: [
    "chatbot",
    "automation",
    "customer support",
    "messenger",
    "lead generation",
  ],
  authors: [{ name: "ReplyBase" }],
  creator: "ReplyBase",
  publisher: "ReplyBase",
  alternates: {
    canonical: appUrl,
  },
  openGraph: {
    type: "website",
    url: appUrl,
    title: "ReplyBase",
    description:
      "Capture every lead, reply instantly, and manage your conversations—all in one simple platform.",
    siteName: "ReplyBase",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "ReplyBase",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ReplyBase",
    description:
      "Capture every lead, reply instantly, and manage your conversations—all in one simple platform.",
    images: ["/twitter-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

import Script from "next/script";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Google Tag Manager */}
        <Script id="gtm-script" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-PCKHK9XS');`}</Script>
        {/* End Google Tag Manager */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-PCKHK9XS"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <AnalyticsScripts />
        <Providers>
          <ImpersonationBanner />
          {children}
        </Providers>
      </body>
    </html>
  );
}
