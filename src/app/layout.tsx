import type { Metadata } from "next";
import { Inter as FontSans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { cn } from "@/utils/cn";

const inter = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "digest",
  description: "a daily digest of your gmail.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn(inter.variable, "antialiased")}>
      <head>
        <title>digest</title>
        <link
          rel="icon"
          type="image/x-icon"
          href="/public/mailbox_with_mail.png"
        ></link>
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

