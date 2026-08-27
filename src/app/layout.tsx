import type { Metadata, Viewport } from "next";
import { Inter as FontSans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { cn } from "@/utils/cn";

const inter = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

// Link scrapers need absolute URLs, so relative paths show nothing.
const site =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const NAME = "digest";
const TAGLINE = "your day at a glance!";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: NAME, template: `%s · ${NAME}` },
  description: TAGLINE,
  icons: {
    icon: "/mailbox_with_mail.png",
    shortcut: "/mailbox_with_mail.png",
    // 180px, which is what iOS asks for and what Messages puts beside a link.
    apple: "/apple-touch-icon.png",
  },
  // No `og:image` on purpose: Messages builds a full-bleed card whenever a page
  // offers one. With only an icon it falls back to the compact style.
  openGraph: {
    type: "website",
    siteName: NAME,
    title: NAME,
    description: TAGLINE,
    url: site,
  },
  twitter: {
    card: "summary",
    title: NAME,
    description: TAGLINE,
  },
};

export const viewport: Viewport = {
  // The stylesheet ships a `prefers-color-scheme` block, so say so: it is what
  // gives scrollbars and form controls the right contrast in either theme.
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e121b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn(inter.variable, "antialiased")}>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

