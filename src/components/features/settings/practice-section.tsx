"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { sb } from "@/lib/supabase/client";
import { useApp } from "@/components/app/app-context";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/utils";

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "");
}

export function PracticeSection() {
  const { settings, refreshMeta } = useApp();
  const [f, setF] = useState({ practice_name: "", phone: "", email: "", address: "", website_url: "", booking_url: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (settings)
      setF({
        practice_name: settings.practice_name,
        phone: settings.phone ?? "",
        email: settings.email ?? "",
        address: settings.address ?? "",
        website_url: settings.website_url ?? "",
        booking_url: settings.booking_url ?? "",
      });
  }, [settings]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    try {
      const { error } = await sb()
        .from("practice_settings")
        .update({
          practice_name: f.practice_name.trim() || "Yusuf Suder Audiology",
          phone: f.phone.trim() || null,
          email: f.email.trim() || null,
          address: f.address.trim() || null,
          website_url: f.website_url.trim() || null,
          booking_url: f.booking_url.trim() || null,
        })
        .eq("id", 1);
      if (error) throw error;
      await refreshMeta();
      toast.success("Practice details saved");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!settings) return <Skeleton className="h-96" />;
  return (
    <Card>
      <CardHeader label="Practice" title="Practice details" />
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <Field label="Practice name" htmlFor="ps-name" className="sm:col-span-2">
          <Input id="ps-name" value={f.practice_name} onChange={set("practice_name")} />
        </Field>
        <Field label="Phone" htmlFor="ps-phone" optional>
          <Input id="ps-phone" type="tel" value={f.phone} onChange={set("phone")} />
        </Field>
        <Field label="Email" htmlFor="ps-email" optional>
          <Input id="ps-email" type="email" value={f.email} onChange={set("email")} />
        </Field>
        <Field label="Address" htmlFor="ps-addr" optional className="sm:col-span-2">
          <Input id="ps-addr" value={f.address} onChange={set("address")} />
        </Field>
        <Field label="Website" htmlFor="ps-web" optional>
          <Input id="ps-web" type="url" placeholder="https://" value={f.website_url} onChange={set("website_url")} />
        </Field>
        <Field label="Booking link used in recall messages" htmlFor="ps-book" optional hint={`Defaults to ${siteUrl()}/book`}>
          <Input id="ps-book" type="url" placeholder={`${siteUrl()}/book`} value={f.booking_url} onChange={set("booking_url")} />
        </Field>
        <div className="sm:col-span-2">
          <Button onClick={save} loading={busy}>
            Save details
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
