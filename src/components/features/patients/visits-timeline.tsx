"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ClipboardList, ImageIcon, Pencil, Plus, ScanLine } from "lucide-react";
import { sb } from "@/lib/supabase/client";
import type { Visit, VisitScan, ScanKind } from "@/lib/types";
import { must } from "@/lib/db";
import { fmtDate, todayISO } from "@/lib/format";
import { useQuery } from "@/lib/hooks/use-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { ScanViewer, type ViewerImage } from "@/components/features/scan-viewer";
import { useApp } from "@/components/app/app-context";
import { REASON_STYLE } from "@/lib/labels";
import { errorMessage } from "@/lib/utils";

const KIND_LABEL: Record<ScanKind, string> = { front: "Front", back: "Back", audiogram: "Audiogram" };
const KIND_ORDER: ScanKind[] = ["front", "back", "audiogram"];

type VisitWithScans = Visit & { scans: VisitScan[] };

export function VisitsTimeline({ patientId, onChanged }: { patientId: string; onChanged?: () => void }) {
  const { reasons } = useApp();
  const [editing, setEditing] = useState<Visit | "new" | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [viewer, setViewer] = useState<{ images: ViewerImage[]; index: number } | null>(null);

  const visits = useQuery(`visits-${patientId}`, () =>
    must(
      sb()
        .from("visits")
        .select("*, scans:visit_scans(*)")
        .eq("patient_id", patientId)
        .order("visit_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ) as Promise<VisitWithScans[]>,
  );

  // Short-lived signed URLs for the private scans bucket
  const paths = useMemo(() => (visits.data ?? []).flatMap((v) => v.scans.map((s) => s.storage_path)), [visits.data]);
  useEffect(() => {
    if (!paths.length) return;
    let alive = true;
    sb()
      .storage.from("patient-scans")
      .createSignedUrls(paths, 60 * 30)
      .then(({ data }) => {
        if (!alive || !data) return;
        const map: Record<string, string> = {};
        data.forEach((d) => {
          if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
        });
        setUrls(map);
      });
    return () => {
      alive = false;
    };
  }, [paths]);

  const reasonById = new Map(reasons.map((r) => [r.id, r]));

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setEditing("new")}>
          <Plus /> Log a visit
        </Button>
        <Button asChild variant="soft">
          <Link href={`/scan?patient=${patientId}`}>
            <ScanLine /> Scan documents
          </Link>
        </Button>
      </div>
      {visits.loading && !visits.data ? (
        <ListSkeleton rows={3} />
      ) : (visits.data ?? []).length === 0 ? (
        <EmptyState icon={ClipboardList} title="No visits yet" description="Visits are added automatically when an appointment is marked Completed." />
      ) : (
        <ol className="relative space-y-4 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-border">
          {visits.data!.map((v) => {
            const reason = v.reason_id ? reasonById.get(v.reason_id) : undefined;
            const style = reason ? REASON_STYLE[reason.color] : REASON_STYLE.slate;
            const scans = [...v.scans].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || (a.created_at > b.created_at ? 1 : -1));
            const images: ViewerImage[] = scans
              .filter((s) => urls[s.storage_path])
              .map((s) => ({ url: urls[s.storage_path], label: `${KIND_LABEL[s.kind]} · ${fmtDate(v.visit_date)}` }));
            return (
              <li key={v.id} className="relative pl-11">
                <span className={`absolute left-[9px] top-5 size-[13px] rounded-full ring-4 ring-bg ${style.bar}`} />
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-display text-[16px] font-semibold text-heading">{fmtDate(v.visit_date, "EEEE d MMMM yyyy")}</div>
                      <Pill tone={style.tone} className="mt-1.5">
                        {v.reason_label ?? reason?.label ?? "Visit"}
                      </Pill>
                    </div>
                    <div className="flex gap-1">
                      <Button asChild variant="ghost" size="icon-sm" aria-label="Add scans to this visit">
                        <Link href={`/scan?patient=${patientId}&visit=${v.id}`}>
                          <ScanLine />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Edit visit" onClick={() => setEditing(v)}>
                        <Pencil />
                      </Button>
                    </div>
                  </div>
                  {v.notes && <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-text">{v.notes}</p>}
                  {scans.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                      {scans.map((s) => {
                        const url = urls[s.storage_path];
                        const idx = images.findIndex((im) => im.url === url);
                        return (
                          <button
                            key={s.id}
                            onClick={() => url && setViewer({ images, index: Math.max(0, idx) })}
                            className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-bg-alt sm:w-28"
                            aria-label={`Open ${KIND_LABEL[s.kind]}`}
                          >
                            {url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={url} alt={KIND_LABEL[s.kind]} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
                            ) : (
                              <div className="skeleton h-full w-full rounded-none" />
                            )}
                            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-5 text-left text-[11.5px] font-semibold text-white">
                              {KIND_LABEL[s.kind]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {scans.length === 0 && (
                    <div className="mt-3 flex items-center gap-2 text-[13px] text-muted">
                      <ImageIcon className="size-4" /> No scans for this visit
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ol>
      )}
      <VisitSheet
        patientId={patientId}
        existing={editing === "new" ? null : editing}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => {
          void visits.reload();
          onChanged?.();
        }}
      />
      <ScanViewer
        images={viewer?.images ?? []}
        index={viewer ? viewer.index : null}
        onIndexChange={(i) => setViewer((v) => (v ? { ...v, index: i } : v))}
        onClose={() => setViewer(null)}
      />
    </div>
  );
}

export function VisitSheet({
  patientId,
  existing,
  open,
  onOpenChange,
  onSaved,
}: {
  patientId: string;
  existing: Visit | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: (id: string) => void;
}) {
  const { reasons, staff } = useApp();
  const [date, setDate] = useState(todayISO());
  const [reasonId, setReasonId] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(existing?.visit_date ?? todayISO());
    setReasonId(existing?.reason_id ?? reasons.find((r) => r.active)?.id ?? "");
    setNotes(existing?.notes ?? "");
  }, [open, existing, reasons]);

  async function save() {
    setBusy(true);
    try {
      const reason = reasons.find((r) => r.id === reasonId);
      const row = { visit_date: date, reason_id: reason?.id ?? null, reason_label: reason?.label ?? null, notes: notes.trim() || null };
      if (existing) {
        const { error } = await sb().from("visits").update(row).eq("id", existing.id);
        if (error) throw error;
        toast.success("Visit updated");
        onSaved(existing.id);
      } else {
        const { data, error } = await sb()
          .from("visits")
          .insert({ ...row, patient_id: patientId, created_by: staff?.id ?? null })
          .select("id")
          .single();
        if (error) throw error;
        toast.success("Visit logged — recall dates updated");
        onSaved((data as { id: string }).id);
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing || !confirm("Delete this visit and its scans?")) return;
    const { data: scans } = await sb().from("visit_scans").select("storage_path").eq("visit_id", existing.id);
    const paths = ((scans as { storage_path: string }[]) ?? []).map((s) => s.storage_path);
    if (paths.length) await sb().storage.from("patient-scans").remove(paths);
    const { error } = await sb().from("visits").delete().eq("id", existing.id);
    if (error) return toast.error(error.message);
    toast.success("Visit deleted");
    onOpenChange(false);
    onSaved(existing.id);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={existing ? "Edit visit" : "Log a visit"}
      footer={
        <>
          {existing && (
            <Button variant="ghost" className="text-crimson hover:bg-coral-bg sm:mr-auto" onClick={remove}>
              Delete
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save visit
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Date" htmlFor="vs-date">
            <Input id="vs-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Reason" htmlFor="vs-reason">
            <Select id="vs-reason" value={reasonId} onChange={(e) => setReasonId(e.target.value)}>
              {reasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Notes" htmlFor="vs-notes" optional>
          <Textarea id="vs-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[140px]" />
        </Field>
      </div>
    </Sheet>
  );
}
