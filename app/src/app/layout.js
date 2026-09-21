import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
// v1.0.1 - PWA Updates Verified
import ServiceWorkerUpdater from "@/components/ServiceWorkerUpdater";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import NotificationPrompt from "@/components/NotificationPrompt";
import { JetBrains_Mono, Inter } from "next/font/google";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata = {
  title: "InventoryOS",
  description: "Gestão de estoque com extração via IA.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "InventoryOS",
  },
  icons: {
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152" },
      { url: "/icons/icon-192x192.png", sizes: "192x192" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  themeColor: "#f5f7fb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased font-sans flex flex-col min-h-dvh bg-background text-foreground">
        <TooltipProvider>
          <ServiceWorkerUpdater />
          <NotificationPrompt />
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
