"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Wallet, LogOut, Loader2 } from "lucide-react";

export function ConnectButton() {
  const { ready, authenticated, login, logout, user } = usePrivy();

  if (!ready) {
    return (
      <button
        disabled
        className="bg-primary/10 text-primary border border-primary/20 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 opacity-50"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading...
      </button>
    );
  }

  if (authenticated && user) {
    const address = user.wallet?.address;
    return (
      <div className="flex items-center gap-2">
        {address && (
          <span className="text-xs font-mono text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        )}
        <button
          onClick={logout}
          className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-white/5"
          title="Disconnect"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
    >
      <Wallet className="w-4 h-4" />
      Connect
    </button>
  );
}
