import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppUpdater } from "@/components/AppUpdater";
import { ManifestThemeSwitcher } from "@/components/ManifestThemeSwitcher";
import { BottomNav } from "@/components/BottomNav";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ma Bédéthèque",
  description: "Gestionnaire de bibliothèque de bandes dessinées.",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    // Best-effort light/dark home-screen icon on iOS (Safari's actual
    // support for switching the *installed* icon via media queries is
    // undocumented/inconsistent — this affects the icon at most at the
    // moment the user adds it to their home screen, not afterwards).
    apple: [
      { url: "/icons/apple-touch-icon.png", media: "(prefers-color-scheme: light)" },
      { url: "/icons/apple-touch-icon-dark.png", media: "(prefers-color-scheme: dark)" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ma Bédéthèque",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { color: "#FACC15", media: "(prefers-color-scheme: light)" },
    { color: "#111111", media: "(prefers-color-scheme: dark)" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
        <AppUpdater />
        <ManifestThemeSwitcher />
        <ToastProvider>
          <OfflineBanner />
          <PullToRefresh />
          {/* Room for the fixed mobile bottom nav (hidden on sm+). */}
          <div className="flex flex-1 flex-col pb-16 sm:pb-0">{children}</div>
          <BottomNav />
        </ToastProvider>
      </body>
    </html>
  );
}
