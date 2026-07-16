"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { useMe } from "@/hooks/use-auth";

const CHROMELESS_PREFIXES = [
  "/forms/",
  "/recruitment/",
  "/login",
  "/register",
  "/auth/callback",
];

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { data: user } = useMe();
  const chromeless = CHROMELESS_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p)
  );

  if (chromeless) {
    return <main className="min-h-screen">{children}</main>;
  }

  const showBottomNav = !!user;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main
        className={`flex-1 bg-bg-secondary ${
          showBottomNav
            ? "pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0"
            : ""
        }`}
      >
        {children}
      </main>
      {/* Footer only on desktop — mobile uses bottom tabs */}
      <div className="hidden md:block">
        <Footer />
      </div>
      <MobileBottomNav />
    </div>
  );
}
