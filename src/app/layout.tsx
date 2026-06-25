import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { RestTimer } from "@/components/RestTimer";

import { TrophyUnlockModal } from "@/components/TrophyUnlockModal";
import { InitRecovery } from "@/components/InitRecovery";
import { PWARegister } from "@/components/PWARegister";
import { CustomToaster } from "@/components/ui/Toast";
import { GlobalListeners } from "@/components/GlobalListeners";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vortixia Fit",
  description: "Gamified mobile-first workout logger & recovery tracker",
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Vortixia Fit",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // Crucial for preventing zoom on input focus in mobile
  userScalable: false,
  themeColor: "#050505",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} h-full antialiased dark`} // Force dark mode
    >
      {/* We limit max-width to simulate mobile-first even on desktop, centering it */}
      <body className="min-h-full flex flex-col mx-auto max-w-md relative bg-background w-full shadow-2xl overflow-x-hidden">
        <PWARegister />
        <InitRecovery />
        <CustomToaster />
        <GlobalListeners />
        {children}
        <BottomNav />
        <RestTimer />
        <TrophyUnlockModal />
      </body>
    </html>
  );
}
