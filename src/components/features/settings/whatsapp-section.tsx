"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Info, Send, TriangleAlert } from "lucide-react";
import { sb } from "@/lib/supabase/client";
import type { PracticeSettings } from "@/lib/types";
import { callFunction } from "@/lib/db";
import { toE164 } from "@/lib/format";
import { useApp } from "@/components/app/app-context";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/utils";

type Status = { configured: boolean; phone_number_id_set: boolean; token_set: boolean } | null;

const MESSAGES: { key: keyof PracticeSettings; title: string; template: string; params: string }[] = [
  { key: "msg_booking_confirmation", title: "Booking confirmation", template: "booking_confirmation", params: "{{1}} first name · {{2}} reason · {{3}} date · {{4}} time" },
  { key: "msg_appointment_reminder", title: "Appointment reminder (24 h before)", template: "appointment_reminder", params: "{{1}} first name · {{2}} reason · {{3}} date · {{4}} time" },
  { key: "msg_recall_reminder", title: "Recall reminder (7 days before)", template: "recall_reminder", params: "{{1}} first name · {{2}} reason · {{3}} due date · {{4}} booking link" },
  { key: "msg_birthday", title: "Birthday greeting", template: "birthday_greeting", params: "No variables" },
];

export function WhatsAppSection() {
  const { settings, refreshMeta } = useApp();
  const [status, setStatus] = useState<Status>(null);
  const [statusErr, setStatusErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<PracticeSettings>>({});
  const [testPhone, setTestPhone] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    callFunction<Status>("send-whatsapp", { action: "status" })
      .then(setStatus)
      .catch((e) => setStatusErr(errorMessage(e)));
  }, []);

  useEffect(() => {
    if (settings)
      setDraft({
        wa_use_templates: settings.wa_use_templates,
        wa_language: settings.wa_language,
        msg_booking_confirmation: settings.msg_booking_confirmation,
        msg_appointment_reminder: settings.msg_appointment_reminder,
        msg_recall_reminder: settings.msg_recall_reminder,
        msg_birthday: settings.msg_birthday,
      });
  }, [settings]);

  async function save() {
    setBusy("save");
    try {
      const { error } = await sb().from("practice_settings").update(draft).eq("id", 1);
      if (error) throw error;
      await refreshMeta();
      toast.success("WhatsApp settings saved");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    const phone = toE164(testPhone);
    if (!phone) return toast.error("Enter a valid mobile number");
    setBusy("test");
    try {
      const res = await callFunction<{ status: string; error?: string }>("send-whatsapp", { action: "test", to: phone });
      if (res.status === "sent") toast.success("Test message sent");
      else if (res.status === "not_sent") toast.warning("Not sent", { description: res.error });
      else toast.error("Test failed", { description: res.error });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (!settings) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-5">
      {status === null && !statusErr ? (
        <Skeleton className="h-20" />
      ) : status?.configured ? (
        <div className="flex items-start gap-3 rounded-2xl border border-sage/30 bg-sage-bg px-4 py-3.5 text-sage-text">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <div className="text-[14px]">
            <div className="font-semibold">WhatsApp is connected</div>
            Messages are sent through the Meta WhatsApp Business Cloud API.
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-2xl border border-amber/30 bg-amber-bg px-4 py-3.5 text-amber-text">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          <div className="text-[14px] leading-relaxed">
            <div className="font-semibold">WhatsApp isn&rsquo;t configured yet</div>
            Everything still works: notifications are created and every message is logged as &ldquo;not sent — WhatsApp not configured&rdquo;. As soon as the
            practice number&rsquo;s credentials (<code className="text-[12.5px]">WHATSAPP_TOKEN</code>, <code className="text-[12.5px]">WHATSAPP_PHONE_NUMBER_ID</code>) are added as Supabase secrets, messages start sending.
            {statusErr && <div className="mt-1 text-[12.5px] opacity-80">({statusErr})</div>}
          </div>
        </div>
      )}

      <Card>
        <CardHeader label="WhatsApp" title="Sending" />
        <CardBody className="space-y-4">
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-bg-alt px-4 py-3">
            <span>
              <span className="block text-[14px] font-medium text-heading">Use Meta-approved templates</span>
              <span className="block text-[12.5px] text-muted">Required for messages outside the 24-hour chat window. Keep this on.</span>
            </span>
            <Switch checked={!!draft.wa_use_templates} onCheckedChange={(v) => setDraft((d) => ({ ...d, wa_use_templates: v }))} />
          </label>
          <Field label="Template language code" hint="Must match the language the templates were approved in (e.g. en, en_US).">
            <Input value={draft.wa_language ?? ""} onChange={(e) => setDraft((d) => ({ ...d, wa_language: e.target.value }))} className="max-w-[160px]" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader label="Wording" title="Message wording" />
        <CardBody className="space-y-5">
          <div className="flex gap-2 rounded-2xl bg-secondary-soft px-4 py-3 text-[13.5px] text-secondary">
            <Info className="mt-0.5 size-4 shrink-0" />
            When templates are on, Meta sends the wording it approved. If you change wording here, submit the same wording to Meta (see docs/whatsapp-templates.md).
          </div>
          {MESSAGES.map((m) => (
            <Field key={m.key} label={m.title} hint={`Template “${m.template}” · ${m.params}`}>
              <Textarea value={String(draft[m.key] ?? "")} onChange={(e) => setDraft((d) => ({ ...d, [m.key]: e.target.value }))} className="min-h-[84px]" />
            </Field>
          ))}
          <Button onClick={save} loading={busy === "save"}>
            Save WhatsApp settings
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader label="Test" title="Send a test message" />
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Mobile number" className="flex-1">
            <Input type="tel" inputMode="tel" placeholder="082 123 4567" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
          </Field>
          <Button onClick={test} loading={busy === "test"}>
            <Send /> Send test message
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
