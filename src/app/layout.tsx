import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#b45309",
};

export const metadata: Metadata = {
  manifest: "/planner/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Planner" },
  icons: {
    apple: "/planner/icons/apple-touch-icon.png",
    icon: "/planner/icons/icon-192.png",
  },
  title: "Structure Planner",
  description:
    "AI-powered plans for sheds, decks, cabins, and garages from photos and questions",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
