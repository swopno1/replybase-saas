import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

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
    "AI-Powered chatbot platform for customer engagement and lead capture.",
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
      "AI-Powered chatbot platform for customer engagement and lead capture.",
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
      "AI-Powered chatbot platform for customer engagement and lead capture.",
    images: ["/twitter-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
