import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Link from "next/link";
import { Globe, Activity, LayoutDashboard, Wallet } from "lucide-react";
import { ConnectButton } from "@/components/ui/ConnectButton";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meridian | Autonomous Prediction Markets",
  description: "AI-driven prediction markets powered by global news.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>
          {/* Navbar */}
          <header className="sticky top-0 z-50 w-full glass-panel border-x-0 border-t-0 rounded-none bg-background/50 backdrop-blur-xl">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
                <Globe className="w-6 h-6" />
                Meridian
              </Link>
              
              <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-foreground/80">
                <Link href="/" className="hover:text-primary flex items-center gap-2 transition-colors">
                  <LayoutDashboard className="w-4 h-4" /> Markets
                </Link>
                <Link href="/agent" className="hover:text-primary flex items-center gap-2 transition-colors">
                  <Activity className="w-4 h-4" /> Agent Activity
                </Link>
                <Link href="/portfolio" className="hover:text-primary flex items-center gap-2 transition-colors">
                  <Wallet className="w-4 h-4" /> Portfolio
                </Link>
              </nav>

              <div className="flex items-center">
                <ConnectButton />
              </div>
            </div>
          </header>

          <main className="flex-1 container mx-auto px-4 py-8">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}

