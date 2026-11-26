"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { sb } from "@/lib/supabase/client";
import type { Staff } from "@/lib/types";
import { YsaBadge } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { AppProvider } from "./app-context";
import { BottomBar, TopBar } from "./nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "ok" | "no-access">("loading");
  const [staff, setStaff] = useState<Staff | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: auth } = await sb().auth.getUser();
      if (!auth.user) {
        router.replace("/login");
        return;
      }
      const { data } = await sb().from("staff").select("*").eq("id", auth.user.id).maybeSingle();
      if (!alive) return;
      if (data && (data as Staff).active) {
        setStaff(data as Staff);
        setState("ok");
      } else setState("no-access");
    })();
    const { data: sub } = sb().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (state === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
          <YsaBadge className="size-14 animate-pulse" />
          <div className="text-sm text-muted">We&rsquo;re hear for you</div>
        </motion.div>
      </div>
    );
  }

  if (state === "no-access" || !staff) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-sm rounded-[22px] border border-border bg-card p-8 text-center shadow-soft">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-coral-bg text-coral-text">
            <ShieldAlert className="size-6" />
          </div>
          <h1 className="text-xl font-semibold">No staff access</h1>
          <p className="mt-2 text-sm text-muted">
            This account isn&rsquo;t set up as practice staff. Ask Dr Yusuf to invite you from Settings → Staff.
          </p>
          <Button
            variant="secondary"
            className="mt-6 w-full"
            onClick={async () => {
              await sb().auth.signOut();
              router.replace("/login");
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppProvider staff={staff}>
      <TopBar />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          className="mx-auto w-full max-w-6xl px-4 pb-32 pt-6 sm:px-6 sm:pt-8 md:pb-36"
        >
          {children}
        </motion.main>
      </AnimatePresence>
      <BottomBar />
    </AppProvider>
  );
}
