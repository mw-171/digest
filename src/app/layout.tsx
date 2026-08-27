import type { Metadata, Viewport } from "next";
import { Inter as FontSans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { cn } from "@/utils/cn";

const inter = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  // `template` lets a page name itself without repeating the product.
  title: { default: "Digest", template: "%s · Digest" },
  description: "A daily digest of your Gmail.",
  icons: { icon: "/mailbox_with_mail.png" },
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
