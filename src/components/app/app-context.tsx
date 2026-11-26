"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { sb } from "@/lib/supabase/client";
import type { PracticeSettings, Reason, Staff } from "@/lib/types";

interface AppCtx {
  staff: Staff | null;
  reasons: Reason[];
  settings: PracticeSettings | null;
  unread: number;
  pendingRequests: number;
  refreshCounts: () => Promise<void>;
  refreshMeta: () => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}

export function AppProvider({ staff, children }: { staff: Staff; children: React.ReactNode }) {
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [settings, setSettings] = useState<PracticeSettings | null>(null);
  const [unread, setUnread] = useState(0);
  const [pendingRequests, setPending] = useState(0);

  const refreshMeta = useCallback(async () => {
    const [r, s] = await Promise.all([
      sb().from("appointment_reasons").select("*").order("sort_order"),
      sb().from("practice_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    if (r.data) setReasons(r.data as Reason[]);
    if (s.data) {
      const st = s.data as PracticeSettings;
      // Make sure recall messages have a booking link (base URL comes from the env, not hardcoded).
      if (!st.booking_url) {
        const base = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "");
        st.booking_url = `${base}/book`;
        void sb().from("practice_settings").update({ booking_url: st.booking_url }).eq("id", 1);
      }
      setSettings(st);
    }
  }, []);

  const refreshCounts = useCallback(async () => {
    const [n, p] = await Promise.all([
      sb().from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
      sb().from("appointments").select("id", { count: "exact", head: true }).eq("status", "requested"),
    ]);
    setUnread(n.count ?? 0);
    setPending(p.count ?? 0);
  }, []);

  useEffect(() => {
    void refreshMeta();
    void refreshCounts();
    const ch = sb()
      .channel("ysa-live-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => void refreshCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => void refreshCounts())
      .subscribe();
    const onFocus = () => void refreshCounts();
    window.addEventListener("focus", onFocus);
    return () => {
      void sb().removeChannel(ch);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshMeta, refreshCounts]);

  const value = useMemo(
    () => ({ staff, reasons, settings, unread, pendingRequests, refreshCounts, refreshMeta }),
    [staff, reasons, settings, unread, pendingRequests, refreshCounts, refreshMeta],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
