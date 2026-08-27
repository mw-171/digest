import type { Metadata, Viewport } from "next";
import { Inter as FontSans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { cn } from "@/utils/cn";

const inter = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

/**
 * Where the app is served from. Link scrapers need absolute URLs, so a preview
 * card built from relative paths shows nothing at all.
 */
const site =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const NAME = "digest";
const TAGLINE = "your day at a glance!";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  // `template` lets a page name itself without repeating the product.
  title: { default: NAME, template: `%s · ${NAME}` },
  description: TAGLINE,
  icons: {
    icon: "/mailbox_with_mail.png",
    shortcut: "/mailbox_with_mail.png",
    // iOS reaches for this one when it has no card image to show.
    apple: "/mailbox_with_mail.png",
  },
  // What Messages, Slack and the rest read. Without these there is nothing to
  // build a card from, so they fall back to the first icon they find.
  openGraph: {
    type: "website",
    siteName: NAME,
    title: NAME,
    description: TAGLINE,
    url: site,
    images: [
      {
        url: "/mailbox_with_mail.png",
        width: 160,
        height: 160,
        alt: `${NAME} — a daily digest of your Gmail`,
      },
    ],
  },
  twitter: {
    // "summary", not "summary_large_image": the icon is square, and the wide
    // card would letterbox it into a mostly empty banner.
    card: "summary",
    title: NAME,
    description: TAGLINE,
    images: ["/mailbox_with_mail.png"],
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

