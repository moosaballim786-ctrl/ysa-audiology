"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Camera, Check, ChevronRight, FileImage, ImagePlus, RefreshCw, SkipForward, UploadCloud } from "lucide-react";
import { sb } from "@/lib/supabase/client";
import type { ScanKind, Visit } from "@/lib/types";
import { fmtDate, todayISO } from "@/lib/format";
import { compressImage } from "@/lib/image";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { Pill } from "@/components/ui/badge";
import { PatientPicker, type PickedPatient } from "@/components/features/patient-picker";
import { useApp } from "@/components/app/app-context";
import { cn, errorMessage } from "@/lib/utils";

const KINDS: { kind: ScanKind; label: string; hint: string }[] = [
  { kind: "front", label: "Front", hint: "Front of the visit information sheet" },
  { kind: "back", label: "Back", hint: "Back of the visit information sheet" },
  { kind: "audiogram", label: "Audiogram", hint: "The patient's audiogram" },
];

const stamp = () => new Date().getTime();

type Shot = { blob: Blob; url: string; width: number; height: number } | null;
type Step = "patient" | "visit" | 0 | 1 | 2 | "review" | "done";

export function ScanFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const { reasons, staff } = useApp();
  const [step, setStep] = useState<Step>("patient");
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [visitId, setVisitId] = useState<string>("");
  const [newReason, setNewReason] = useState("");
  const [shots, setShots] = useState<Record<ScanKind, Shot>>({ front: null, back: null, audiogram: null });
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const today = todayISO();

  // Deep-link: /scan?patient=…&visit=…
  useEffect(() => {
    const pid = params.get("patient");
    if (!pid) return;
    sb()
      .from("patients")
      .select("id, full_name, phone")
      .eq("id", pid)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPatient(data as PickedPatient);
          setStep("visit");
        }
      });
  }, [params]);

  useEffect(() => {
    if (!patient) return;
    setVisits(null);
    sb()
      .from("visits")
      .select("*")
      .eq("patient_id", patient.id)
      .order("visit_date", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        const list = (data as Visit[]) ?? [];
        setVisits(list);
        const fromParam = params.get("visit");
        const todays = list.find((v) => v.visit_date === today);
        setVisitId(fromParam && list.some((v) => v.id === fromParam) ? fromParam : todays?.id ?? "new");
      });
  }, [patient, params, today]);

  useEffect(() => {
    if (!newReason && reasons.length) setNewReason(reasons.find((r) => r.active)?.id ?? "");
  }, [reasons, newReason]);

  useEffect(
    () => () => {
      Object.values(shots).forEach((s) => s && URL.revokeObjectURL(s.url));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function onFile(kind: ScanKind, file: File | undefined, idx: number) {
    if (!file) return;
    setProcessing(true);
    try {
      const { blob, width, height } = await compressImage(file);
      setShots((s) => {
        if (s[kind]) URL.revokeObjectURL(s[kind]!.url);
        return { ...s, [kind]: { blob, url: URL.createObjectURL(blob), width, height } };
      });
      setTimeout(() => setStep(idx < 2 ? ((idx + 1) as Step) : "review"), 350);
    } catch (e) {
      toast.error("Couldn't read that image", { description: errorMessage(e) });
    } finally {
      setProcessing(false);
    }
  }

  async function save() {
    if (!patient) return;
    const toUpload = KINDS.filter((k) => shots[k.kind]);
    if (!toUpload.length) return toast.error("Capture at least one image");
    setSaving(true);
    setProgress(0);
    try {
      let vId = visitId;
      if (vId === "new") {
        const reason = reasons.find((r) => r.id === newReason);
        const { data, error } = await sb()
          .from("visits")
          .insert({ patient_id: patient.id, visit_date: today, reason_id: reason?.id ?? null, reason_label: reason?.label ?? null, created_by: staff?.id ?? null })
          .select("id")
          .single();
        if (error) throw error;
        vId = (data as { id: string }).id;
      }
      let done = 0;
      for (const k of toUpload) {
        const shot = shots[k.kind]!;
        const path = `patients/${patient.id}/visits/${vId}/${k.kind}-${stamp()}.jpg`;
        const { error: upErr } = await sb().storage.from("patient-scans").upload(path, shot.blob, { contentType: "image/jpeg", upsert: false });
        if (upErr) throw upErr;
        const { error } = await sb().from("visit_scans").insert({
          visit_id: vId,
          patient_id: patient.id,
          kind: k.kind,
          storage_path: path,
          width: shot.width,
          height: shot.height,
          size_bytes: shot.blob.size,
          created_by: staff?.id ?? null,
        });
        if (error) throw error;
        done++;
        setProgress(done / toUpload.length);
      }
      toast.success(`${done} scan${done === 1 ? "" : "s"} saved to ${patient.full_name}'s history`);
      setStep("done");
    } catch (e) {
      toast.error("Saving failed", { description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  function restart() {
    Object.values(shots).forEach((s) => s && URL.revokeObjectURL(s.url));
    setShots({ front: null, back: null, audiogram: null });
    setPatient(null);
    setVisitId("");
    setStep("patient");
    router.replace("/scan");
  }

  const visit = visits?.find((v) => v.id === visitId);
  const stepIndex = step === "patient" ? 0 : step === "visit" ? 1 : typeof step === "number" ? 2 + step : step === "review" ? 5 : 6;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader label="Scan" title="Scan documents" subtitle="Photograph the visit sheet (front & back) and the audiogram." />
      <div className="mb-6 flex gap-1.5">
        {["Patient", "Visit", "Front", "Back", "Audiogram", "Review"].map((l, i) => (
          <div key={l} className="flex-1">
            <div className={cn("h-1 rounded-full transition-colors", i <= stepIndex ? "bg-primary" : "bg-[#e4e9ef]")} />
            <div className={cn("mt-1.5 hidden text-[11.5px] font-medium sm:block", i <= stepIndex ? "text-primary-hover" : "text-muted")}>{l}</div>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={String(step)} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.2 }}>
          {step === "patient" && (
            <Card className="p-5">
              <h2 className="mb-4 text-[18px] font-semibold">Select the patient</h2>
              <PatientPicker
                value={patient}
                onChange={(p) => {
                  setPatient(p);
                  if (p) setStep("visit");
                }}
              />
            </Card>
          )}

          {step === "visit" && patient && (
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-[18px] font-semibold">Which visit?</h2>
                <Button variant="ghost" size="sm" onClick={() => setStep("patient")}>
                  {patient.full_name} · change
                </Button>
              </div>
              {!visits ? (
                <div className="skeleton h-24" />
              ) : (
                <div className="space-y-2">
                  {!visits.some((v) => v.visit_date === today) && (
                    <VisitOption selected={visitId === "new"} onClick={() => setVisitId("new")} title="Today's visit (new)" subtitle={fmtDate(today, "EEEE d MMMM")} badge="New" />
                  )}
                  {visits.map((v) => (
                    <VisitOption
                      key={v.id}
                      selected={visitId === v.id}
                      onClick={() => setVisitId(v.id)}
                      title={v.visit_date === today ? "Today's visit" : fmtDate(v.visit_date, "EEEE d MMMM yyyy")}
                      subtitle={v.reason_label ?? "Visit"}
                    />
                  ))}
                </div>
              )}
              {visitId === "new" && (
                <Field label="Reason for today's visit" htmlFor="sc-reason" className="mt-4">
                  <Select id="sc-reason" value={newReason} onChange={(e) => setNewReason(e.target.value)}>
                    {reasons.filter((r) => r.active).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Button size="lg" className="mt-5 w-full" disabled={!visitId} onClick={() => setStep(0)}>
                Continue <ChevronRight />
              </Button>
            </Card>
          )}

          {typeof step === "number" && (
            <CaptureStep
              key={KINDS[step].kind}
              spec={KINDS[step]}
              shot={shots[KINDS[step].kind]}
              processing={processing}
              onFile={(f) => onFile(KINDS[step].kind, f, step)}
              onSkip={() => setStep(step < 2 ? ((step + 1) as Step) : "review")}
              onBack={() => setStep(step === 0 ? "visit" : ((step - 1) as Step))}
              onNext={() => setStep(step < 2 ? ((step + 1) as Step) : "review")}
            />
          )}

          {step === "review" && patient && (
            <Card className="p-5">
              <h2 className="text-[18px] font-semibold">Review</h2>
              <p className="mt-1 text-[14px] text-muted">
                {patient.full_name} · {visitId === "new" ? `Today's visit (${fmtDate(today, "d MMM")})` : visit ? fmtDate(visit.visit_date, "d MMM yyyy") : ""}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {KINDS.map((k, i) => {
                  const s = shots[k.kind];
                  return (
                    <div key={k.kind}>
                      <button
                        onClick={() => setStep(i as Step)}
                        className={cn(
                          "relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-2xl border",
                          s ? "border-border" : "border-dashed border-[#cfd8e1] bg-bg-alt",
                        )}
                      >
                        {s ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.url} alt={k.label} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[12.5px] text-muted">Skipped</span>
                        )}
                      </button>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-heading">{k.label}</span>
                        {s && <span className="tnum text-[11.5px] text-muted">{Math.round(s.blob.size / 1024)} KB</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {saving && (
                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#e4e9ef]">
                  <motion.div className="h-full bg-primary" animate={{ width: `${Math.max(8, progress * 100)}%` }} />
                </div>
              )}
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
                <Button variant="secondary" onClick={() => setStep(2)} disabled={saving}>
                  Back
                </Button>
                <Button size="lg" className="flex-1" onClick={save} loading={saving}>
                  <UploadCloud /> Save to patient history
                </Button>
              </div>
            </Card>
          )}

          {step === "done" && patient && (
            <Card className="p-8 text-center">
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-sage-bg text-sage"
              >
                <Check className="size-8" />
              </motion.div>
              <h2 className="text-[22px] font-bold">Scans saved</h2>
              <p className="mt-2 text-muted">They&rsquo;re on {patient.full_name}&rsquo;s visit timeline.</p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button asChild variant="secondary">
                  <Link href={`/patients/${patient.id}`}>Open patient</Link>
                </Button>
                <Button onClick={restart}>
                  <Camera /> Scan another patient
                </Button>
              </div>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function VisitOption({ selected, onClick, title, subtitle, badge }: { selected: boolean; onClick: () => void; title: string; subtitle: string; badge?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
        selected ? "border-primary bg-primary-soft/70 ring-2 ring-primary/15" : "border-border bg-card hover:border-[#d5dde5]",
      )}
    >
      <span className={cn("flex size-5 items-center justify-center rounded-full border-2", selected ? "border-primary bg-primary" : "border-[#cfd8e1]")}>
        {selected && <Check className="size-3 text-white" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-heading">{title}</span>
        <span className="block text-[13px] text-muted">{subtitle}</span>
      </span>
      {badge && <Pill tone="teal">{badge}</Pill>}
    </button>
  );
}

function CaptureStep({
  spec,
  shot,
  processing,
  onFile,
  onSkip,
  onBack,
  onNext,
}: {
  spec: { kind: ScanKind; label: string; hint: string };
  shot: Shot;
  processing: boolean;
  onFile: (f: File | undefined) => void;
  onSkip: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => shot?.url, [shot]);
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold">Capture {spec.label}</h2>
          <p className="text-[14px] text-muted">{spec.hint}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
      </div>

      <div
        className={cn(
          "relative flex aspect-[3/4] max-h-[52vh] w-full items-center justify-center overflow-hidden rounded-2xl border-2 sm:aspect-[4/3]",
          preview ? "border-border bg-[#0b1220]" : "border-dashed border-[#cfd8e1] bg-bg-alt",
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={spec.label} className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 text-center text-muted">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <FileImage className="size-7" strokeWidth={1.6} />
            </div>
            <span className="text-[14px]">Place the page on a flat surface with good light.</span>
          </div>
        )}
        {processing && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-[14px] font-medium text-heading backdrop-blur-sm">
            Optimising image…
          </div>
        )}
      </div>

      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={gallery} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button size="xl" onClick={() => camera.current?.click()} disabled={processing} className="col-span-2">
          {shot ? <RefreshCw /> : <Camera />} {shot ? "Retake photo" : "Take photo"}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => gallery.current?.click()} disabled={processing}>
          <ImagePlus /> Upload
        </Button>
        {shot ? (
          <Button variant="soft" size="lg" onClick={onNext}>
            Next <ChevronRight />
          </Button>
        ) : (
          <Button variant="ghost" size="lg" onClick={onSkip}>
            <SkipForward /> Skip
          </Button>
        )}
      </div>
    </Card>
  );
}
