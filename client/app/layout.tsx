import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Link from "next/link";
import { Globe, Activity, LayoutDashboard, Wallet, ExternalLink } from "lucide-react";
import { ConnectButton } from "@/components/ui/ConnectButton";
import { Toaster } from "sonner";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
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
    <html lang="en" className={`${spaceGrotesk.variable} h-full antialiased`}>
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

          <footer className="border-t border-white/5 bg-background/30 backdrop-blur-sm mt-12">
            <div className="container mx-auto px-4 py-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Brand */}
                <div>
                  <div className="flex items-center gap-2 text-primary font-bold text-lg mb-2">
                    <Globe className="w-5 h-5" />
                    Meridian
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Autonomous prediction markets sourced from foreign-language financial news.
                    Built on Arc for the Agora Agents Hackathon.
                  </p>
                </div>

                {/* Links */}
                <div>
                  <p className="text-xs font-bold text-foreground/60 uppercase tracking-wider mb-3">Navigate</p>
                  <div className="space-y-2">
                    {[
                      { href: "/", label: "Markets" },
                      { href: "/agent", label: "Agent Activity" },
                      { href: "/portfolio", label: "Portfolio" },
                    ].map(({ href, label }) => (
                      <Link key={href} href={href} className="block text-xs text-muted-foreground hover:text-primary transition-colors">
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Contracts & API */}
                <div>
                  <p className="text-xs font-bold text-foreground/60 uppercase tracking-wider mb-3">Deployed</p>
                  <div className="space-y-2 font-mono text-[11px]">
                    <a
                      href="https://testnet.arcscan.app/address/0x2276EcD90c1E8A8939C70c8F70dcE69C3c2704f6"
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      MeridianMarket
                    </a>
                    <a
                      href="https://testnet.arcscan.app/address/0x31f85C18172BAA5d796Ff140D8dB4799bcF1a8BF"
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      AgentVault
                    </a>
                    <a
                      href="https://meridian-hbnz.onrender.com/"
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      Backend API
                    </a>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>Meridian · Arc Testnet · Chain ID 5042002</span>
                <span>Agent ID <span className="text-primary font-mono">18359</span> · ERC-8004 · x402 Payment Gate</span>
              </div>
            </div>
          </footer>

          <Toaster position="bottom-right" theme="dark" richColors />
        </Providers>
      </body>
    </html>
  );
}

