"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, LogIn, LogOut, Sparkles, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const navLinks = [
  { label: "How It Works", href: "/#how" },
  { label: "Services", href: "/#services" },
  { label: "Why Us", href: "/#why" },
  { label: "Gallery", href: "/gallery" },
  { label: "Subscriptions", href: "/subscriptions" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{ id?: string; email?: string } | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    async function init(userId: string) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", userId)
        .single();
      if (profile?.first_name) setFirstName(profile.first_name);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      setLoading(false);
      if (u?.id) init(u.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setLoading(false);
      if (u?.id) init(u.id);
      if (!u) setFirstName(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
    router.refresh();
  };

  const isLoggedIn = !loading && !!user;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-navy border-b border-blue2/40">
      <nav className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-baseline gap-1.5 select-none">
          <span className="font-[family-name:var(--font-heading)] text-3xl leading-none tracking-wide text-cyan">
            WOW
          </span>
          <span className="font-[family-name:var(--font-heading)] text-3xl leading-none tracking-wide text-white">
            CLEAN
          </span>
        </Link>

        {/* Desktop nav links */}
        <ul className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                className="font-[family-name:var(--font-barlow-condensed)] text-[15px] font-semibold uppercase tracking-wider text-silver/80 hover:text-cyan transition-colors px-3 py-2 rounded-md hover:bg-white/5"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Desktop right actions */}
        <div className="hidden lg:flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <Link href="/account">
                <Button
                  variant="ghost"
                  size="sm"
                  className="font-[family-name:var(--font-barlow-condensed)] tracking-wider text-silver/80 hover:text-white gap-1.5"
                >
                  <User className="size-4" />
                  {firstName || "Account"}
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-silver/80 hover:text-white gap-1.5"
              >
                <LogOut className="size-4" />
                Sign Out
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button
                variant="ghost"
                size="sm"
                className="font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-silver/80 hover:text-white gap-1.5"
              >
                <LogIn className="size-4" />
                Login
              </Button>
            </Link>
          )}
          <Link href="/book">
            <Button
              size="sm"
              className="font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider bg-cyan text-navy font-bold hover:bg-cyan/85 animate-pulse gap-1.5 px-4"
            >
              <Sparkles className="size-4" />
              Book Now
            </Button>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <div className="flex lg:hidden items-center gap-2">
          <Link href="/book">
            <Button
              size="sm"
              className="font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider bg-cyan text-navy font-bold hover:bg-cyan/85 animate-pulse gap-1.5 px-3 text-xs"
            >
              <Sparkles className="size-3.5" />
              Book
            </Button>
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="inline-flex items-center justify-center rounded-md p-2 text-silver hover:text-cyan hover:bg-white/5 transition-colors">
              <Menu className="size-6" />
              <span className="sr-only">Open menu</span>
            </SheetTrigger>
            <SheetContent side="right" className="bg-navy border-blue2/40 w-[280px]">
              <SheetHeader>
                <SheetTitle className="flex items-baseline gap-1.5">
                  <span className="font-[family-name:var(--font-heading)] text-2xl text-cyan">
                    WOW
                  </span>
                  <span className="font-[family-name:var(--font-heading)] text-2xl text-white">
                    CLEAN
                  </span>
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-1 px-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="font-[family-name:var(--font-barlow-condensed)] block text-base font-semibold uppercase tracking-wider text-silver/80 hover:text-cyan transition-colors px-3 py-2.5 rounded-md hover:bg-white/5"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              <div className="mt-auto flex flex-col gap-3 px-4 pb-6">
                {isLoggedIn ? (
                  <>
                    <Link href="/account" onClick={() => setOpen(false)}>
                      <Button
                        variant="outline"
                        className="w-full font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-silver border-blue2/60 hover:text-cyan gap-2"
                      >
                        <User className="size-4" />
                        {firstName || "Account"}
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      onClick={() => {
                        handleSignOut();
                        setOpen(false);
                      }}
                      className="w-full font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-silver border-blue2/60 hover:text-cyan gap-2"
                    >
                      <LogOut className="size-4" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <Link href="/login" onClick={() => setOpen(false)}>
                    <Button
                      variant="outline"
                      className="w-full font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-silver border-blue2/60 hover:text-cyan gap-2"
                    >
                      <LogIn className="size-4" />
                      Login
                    </Button>
                  </Link>
                )}
                <Link href="/book" onClick={() => setOpen(false)}>
                  <Button className="w-full font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider bg-cyan text-navy font-bold hover:bg-cyan/85 gap-2">
                    <Sparkles className="size-4" />
                    Book Now
                  </Button>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
