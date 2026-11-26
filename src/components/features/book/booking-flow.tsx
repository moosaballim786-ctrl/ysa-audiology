"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Ear,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { YsaBadge, YsaWordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { addDaysISO, fmtDate, toE164 } from "@/lib/format";
import { cn, errorMessage } from "@/lib/utils";

// Anonymous client: no session — can only call the public booking functions.
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface Options {
  practice_name: string;
  horizon_days: number;
  today: string;
  reasons: { code: string; label: string; duration_minutes: number }[];
  open_weekdays: number[];
}
interface Slot {
  slot_start: string;
  slot_label: string;
}

const REASON_COPY: Record<string, { blurb: string; icon: typeof Ear }> = {
  hearing_assessment: { blurb: "A full diagnostic hearing test with the audiologist.", icon: Ear },
  wax_removal: { blurb: "Safe, gentle professional ear wax removal and cleaning.", icon: Sparkles },
};

type Step = 0 | 1 | 2 | 3 | 4;

export function BookingFlow() {
  const embed = useSearchParams().get("embed") === "1";
  const [opts, setOpts] = useState<Options | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(0);
  const [reason, setReason] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [slot, setSlot] = useState<Slot | null>(null);

  useEffect(() => {
    anon.rpc("get_booking_options").then(({ data, error }) => {
      if (error) setLoadError("We couldn't load the booking calendar. Please try again shortly.");
      else setOpts(data as Options);
    });
  }, []);

  const reasonObj = opts?.reasons.find((r) => r.code === reason);

  return (
    <div className={cn("min-h-dvh bg-bg", embed && "min-h-0 bg-transparent")}>
      {!embed && (
        <header className="glass sticky top-0 z-30 border-b border-border/70">
          <div className="mx-auto flex h-16 max-w-3xl items-center px-5">
            <YsaWordmark size="sm" />
          </div>
        </header>
      )}
      <main className={cn("mx-auto max-w-3xl px-5", embed ? "py-5" : "py-10 sm:py-14")}>
        {step < 4 && (
          <div className="mb-8">
            {!embed && <div className="label-caps mb-2">Online booking</div>}
            <h1 className="text-[30px] font-bold leading-tight sm:text-[36px]">Book an appointment</h1>
            <p className="mt-2 text-[15px] text-muted">
              Choose a time that suits you — we&rsquo;ll confirm on WhatsApp. <span className="text-primary">We&rsquo;re hear for you.</span>
            </p>
            <Stepper step={step} />
          </div>
        )}

        {loadError && <div className="rounded-2xl bg-coral-bg p-4 text-coral-text">{loadError}</div>}
        {!opts && !loadError && <div className="skeleton h-72 w-full" />}

        {opts && (
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {step === 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {opts.reasons.map((r) => {
                    const meta = REASON_COPY[r.code] ?? { blurb: "", icon: Ear };
                    const Icon = meta.icon;
                    return (
                      <button
                        key={r.code}
                        onClick={() => {
                          setReason(r.code);
                          setDate("");
                          setSlot(null);
                          setStep(1);
                        }}
                        className={cn(
                          "group rounded-[20px] border bg-card p-5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift",
                          reason === r.code ? "border-primary ring-2 ring-primary/20" : "border-border",
                        )}
                      >
                        <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary transition group-hover:bg-primary group-hover:text-white">
                          <Icon className="size-6" strokeWidth={1.8} />
                        </div>
                        <div className="font-display text-[18px] font-semibold text-heading">{r.label}</div>
                        <p className="mt-1 text-[14px] text-muted">{meta.blurb}</p>
                        <div className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary">
                          <Clock className="size-3.5" /> About {r.duration_minutes} minutes
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {step === 1 && reasonObj && (
                <div>
                  <BackLink onClick={() => setStep(0)} label={reasonObj.label} />
                  <DatePicker
                    opts={opts}
                    reason={reason}
                    value={date}
                    onPick={(d) => {
                      setDate(d);
                      setSlot(null);
                      setStep(2);
                    }}
                  />
                </div>
              )}

              {step === 2 && reasonObj && (
                <div>
                  <BackLink onClick={() => setStep(1)} label={fmtDate(date, "EEEE d MMMM")} />
                  <SlotPicker
                    date={date}
                    reason={reason}
                    value={slot}
                    onPick={(s) => {
                      setSlot(s);
                      setStep(3);
                    }}
                  />
                </div>
              )}

              {step === 3 && reasonObj && slot && (
                <div>
                  <BackLink onClick={() => setStep(2)} label="Change time" />
                  <DetailsForm reasonLabel={reasonObj.label} reasonCode={reason} date={date} slot={slot} onDone={() => setStep(4)} onSlotTaken={() => setStep(2)} />
                </div>
              )}

              {step === 4 && reasonObj && slot && (
                <div className="mx-auto max-w-md py-10 text-center">
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18 }}
                    className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-sage-bg text-sage"
                  >
                    <Check className="size-10" strokeWidth={2.2} />
                  </motion.div>
                  <h2 className="text-[28px] font-bold">Request received</h2>
                  <p className="mt-3 text-[16px] leading-relaxed text-text">
                    Request received — we&rsquo;ll confirm on WhatsApp shortly.
                  </p>
                  <div className="mt-6 rounded-2xl border border-border bg-card p-4 text-left shadow-soft">
                    <div className="text-[13px] text-muted">{reasonObj.label}</div>
                    <div className="mt-1 font-display text-[17px] font-semibold text-heading">
                      {fmtDate(date, "EEEE d MMMM")} at <span className="tnum">{slot.slot_label}</span>
                    </div>
                  </div>
                  <p className="mt-8 text-[14px] font-medium text-primary">We&rsquo;re hear for you</p>
                  <Button
                    variant="secondary"
                    className="mt-6"
                    onClick={() => {
                      setStep(0);
                      setReason("");
                      setDate("");
                      setSlot(null);
                    }}
                  >
                    Make another booking
                  </Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      {!embed && (
        <footer className="mx-auto max-w-3xl px-5 pb-10 pt-4 text-center text-[12.5px] text-muted">
          <YsaBadge className="mx-auto mb-2 size-7 opacity-80" />© {new Date().getFullYear()} Yusuf Suder Audiology · We&rsquo;re hear for you
        </footer>
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels = ["Reason", "Date", "Time", "Your details"];
  return (
    <ol className="mt-6 flex items-center gap-2">
      {labels.map((l, i) => (
        <li key={l} className="flex flex-1 flex-col gap-1.5">
          <span className={cn("h-1 rounded-full transition-colors duration-300", i <= step ? "bg-primary" : "bg-[#e4e9ef]")} />
          <span className={cn("hidden text-[12px] font-medium sm:block", i <= step ? "text-primary-hover" : "text-muted")}>{l}</span>
        </li>
      ))}
    </ol>
  );
}

function BackLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="mb-5 inline-flex h-10 items-center gap-2 rounded-xl pr-3 text-[14px] font-medium text-muted transition hover:text-heading">
      <ArrowLeft className="size-4" /> {label}
    </button>
  );
}

function DatePicker({ opts, reason, value, onPick }: { opts: Options; reason: string; value: string; onPick: (d: string) => void }) {
  const [month, setMonth] = useState(opts.today.slice(0, 7) + "-01");
  const [available, setAvailable] = useState<Set<string> | null>(null);
  const lastDay = addDaysISO(opts.today, opts.horizon_days);

  useEffect(() => {
    setAvailable(null);
    const monthEnd = addDaysISO(addDaysISO(month, 31).slice(0, 7) + "-01", -1);
    anon
      .rpc("get_available_dates", { p_from: month, p_to: monthEnd, p_reason_code: reason })
      .then(({ data }) => setAvailable(new Set((data as string[] | null) ?? [])));
  }, [month, reason]);

  const days = useMemo(() => {
    const first = Number(fmtDate(month, "i")); // 1=Mon
    const count = Number(fmtDate(addDaysISO(addDaysISO(month, 31).slice(0, 7) + "-01", -1), "d"));
    const cells: (string | null)[] = Array.from({ length: first - 1 }, () => null);
    for (let i = 0; i < count; i++) cells.push(addDaysISO(month, i));
    return cells;
  }, [month]);

  const canPrev = month > opts.today.slice(0, 7) + "-01";
  const canNext = addDaysISO(month, 32).slice(0, 7) <= lastDay.slice(0, 7);

  return (
    <div className="rounded-[22px] border border-border bg-card p-4 shadow-soft sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-display text-[18px] font-semibold text-heading">
          <CalendarDays className="size-5 text-primary" /> {fmtDate(month, "MMMM yyyy")}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" disabled={!canPrev} onClick={() => setMonth(addDaysISO(month, -1).slice(0, 7) + "-01")} aria-label="Previous month">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon" disabled={!canNext} onClick={() => setMonth(addDaysISO(month, 32).slice(0, 7) + "-01")} aria-label="Next month">
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="pb-2 text-[11.5px] font-semibold uppercase tracking-wider text-muted">
            {d}
          </div>
        ))}
        {days.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const ok = available?.has(d) ?? false;
          const selected = d === value;
          return (
            <button
              key={d}
              disabled={!ok}
              onClick={() => onPick(d)}
              className={cn(
                "tnum relative mx-auto flex aspect-square w-full max-w-[52px] items-center justify-center rounded-2xl text-[15px] font-semibold transition-all",
                selected
                  ? "bg-primary text-white shadow-[0_6px_16px_-6px_rgba(42,127,143,.6)]"
                  : ok
                    ? "bg-primary-soft/70 text-primary-hover hover:bg-primary hover:text-white"
                    : "text-[#b6c0cc]",
                !available && "animate-pulse",
              )}
              aria-label={fmtDate(d, "EEEE d MMMM")}
            >
              {Number(d.slice(8))}
              {d === opts.today && <span className="absolute bottom-1.5 size-1 rounded-full bg-current" />}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-[13px] text-muted">Highlighted days have open times.</p>
    </div>
  );
}

function SlotPicker({ date, reason, value, onPick }: { date: string; reason: string; value: Slot | null; onPick: (s: Slot) => void }) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  useEffect(() => {
    anon.rpc("get_available_slots", { p_date: date, p_reason_code: reason }).then(({ data }) => setSlots((data as Slot[]) ?? []));
  }, [date, reason]);

  if (!slots) return <div className="skeleton h-48 w-full" />;
  if (slots.length === 0)
    return <div className="rounded-2xl border border-border bg-card p-6 text-center text-muted">No times left on this day. Please choose another date.</div>;

  const groups = [
    { label: "Morning", list: slots.filter((s) => s.slot_label < "12:00") },
    { label: "Afternoon", list: slots.filter((s) => s.slot_label >= "12:00") },
  ].filter((g) => g.list.length);

  return (
    <div className="space-y-6 rounded-[22px] border border-border bg-card p-4 shadow-soft sm:p-6">
      {groups.map((g) => (
        <div key={g.label}>
          <div className="label-caps mb-3">{g.label}</div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {g.list.map((s) => (
              <button
                key={s.slot_start}
                onClick={() => onPick(s)}
                className={cn(
                  "tnum h-12 rounded-xl border text-[15px] font-semibold transition-all active:scale-[0.97]",
                  value?.slot_start === s.slot_start
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-card text-heading hover:border-primary/50 hover:bg-primary-soft",
                )}
              >
                {s.slot_label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailsForm({
  reasonLabel,
  reasonCode,
  date,
  slot,
  onDone,
  onSlotTaken,
}: {
  reasonLabel: string;
  reasonCode: string;
  date: string;
  slot: Slot;
  onDone: () => void;
  onSlotTaken: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = "Please enter your full name.";
    if (!toE164(phone)) errs.phone = "Please enter a valid mobile number, e.g. 082 123 4567.";
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) errs.email = "Please check your email address.";
    if (!consent) errs.consent = "Please tick the box so we can confirm your booking on WhatsApp.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    // Bots submit instantly; real people take a few seconds.
    const tooFast = Date.now() - startedAt < 1500;
    setBusy(true);
    setFormError(null);
    try {
      const { error } = await anon.rpc("request_booking", {
        p_reason_code: reasonCode,
        p_starts_at: slot.slot_start,
        p_full_name: name.trim(),
        p_phone: phone,
        p_email: email.trim() || null,
        p_date_of_birth: dob || null,
        p_note: note.trim() || null,
        p_consent: consent,
        p_website: website || (tooFast ? "fast" : null),
      });
      if (error) throw error;
      onDone();
    } catch (err) {
      const msg = errorMessage(err);
      setFormError(msg);
      if (msg.includes("no longer available")) setTimeout(onSlotTaken, 1800);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-[22px] border border-border bg-card p-5 shadow-soft sm:p-7" noValidate>
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-primary-soft px-4 py-3">
        <Clock className="size-5 text-primary" />
        <div className="text-[14.5px]">
          <span className="font-semibold text-heading">{reasonLabel}</span>
          <span className="text-text">
            {" "}· {fmtDate(date, "EEE d MMMM")} at <span className="tnum font-semibold">{slot.slot_label}</span>
          </span>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="bk-name" error={errors.name} className="sm:col-span-2">
          <Input id="bk-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Mobile number" htmlFor="bk-phone" error={errors.phone} hint="We'll confirm on WhatsApp.">
          <Input id="bk-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="082 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="bk-email" optional error={errors.email}>
          <Input id="bk-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Date of birth" htmlFor="bk-dob" optional hint="So we can wish you a happy birthday.">
          <Input id="bk-dob" type="date" autoComplete="bday" value={dob} onChange={(e) => setDob(e.target.value)} />
        </Field>
        <Field label="Short note" htmlFor="bk-note" optional className="sm:col-span-2">
          <Textarea id="bk-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything we should know?" />
        </Field>
      </div>
      {/* Honeypot — hidden from people, tempting to bots */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="bk-website">Website</label>
        <input id="bk-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <label
        className={cn(
          "mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition",
          consent ? "border-sage/40 bg-sage-bg/60" : errors.consent ? "border-coral/40 bg-coral-bg/50" : "border-border bg-bg-alt",
        )}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[#2A7F8F]"
          required
        />
        <span className="text-[14px] leading-relaxed text-text">
          <MessageCircle className="mr-1 inline size-4 text-sage" />
          I agree to receive appointment messages from Yusuf Suder Audiology on WhatsApp.
        </span>
      </label>
      {errors.consent && <p className="mt-1.5 text-[13px] text-coral-text">{errors.consent}</p>}
      {formError && <div className="mt-4 rounded-xl bg-coral-bg px-4 py-3 text-[14px] text-coral-text">{formError}</div>}
      <Button type="submit" size="xl" className="mt-6 w-full" loading={busy}>
        Request appointment
      </Button>
      <p className="mt-3 text-center text-[12.5px] text-muted">Your request is confirmed once the practice approves it.</p>
    </form>
  );
}
