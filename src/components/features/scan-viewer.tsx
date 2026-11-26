"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ViewerImage {
  url: string;
  label: string;
}

/** Full-screen image viewer: pinch-zoom, double-tap zoom, pan, swipe between images. */
export function ScanViewer({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: ViewerImage[];
  index: number | null;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const open = index !== null;
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [swipeX, setSwipeX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; scale: number; x: number; y: number; tx: number; ty: number; startX: number } | null>(null);
  const lastTap = useRef(0);

  const reset = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
    setSwipeX(0);
  }, []);

  useEffect(reset, [index, reset]);

  const go = useCallback(
    (d: 1 | -1) => {
      if (index === null) return;
      const n = index + d;
      if (n >= 0 && n < images.length) onIndexChange(n);
    },
    [index, images.length, onIndexChange],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      gesture.current = { dist, scale, x: 0, y: 0, tx, ty, startX: 0 };
    } else if (pts.length === 1) {
      const now = Date.now();
      if (now - lastTap.current < 280) {
        if (scale > 1) reset();
        else setScale(2.5);
        lastTap.current = 0;
        return;
      }
      lastTap.current = now;
      gesture.current = { dist: 0, scale, x: e.clientX, y: e.clientY, tx, ty, startX: e.clientX };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    if (pts.length === 2 && g.dist) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      setScale(Math.min(5, Math.max(1, (g.scale * dist) / g.dist)));
    } else if (pts.length === 1) {
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      if (scale > 1) {
        setTx(g.tx + dx);
        setTy(g.ty + dy);
      } else {
        setSwipeX(dx);
      }
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      setDragging(false);
      if (scale <= 1.02) {
        if (swipeX < -60) go(1);
        else if (swipeX > 60) go(-1);
        reset();
      }
      gesture.current = null;
    } else if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()];
      gesture.current = { dist: 0, scale, x: p.x, y: p.y, tx, ty, startX: p.x };
    }
  }

  const img = index !== null ? images[index] : null;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[#0b1220]/95 data-[state=open]:animate-[fadeIn_.2s_ease-out]" />
        <Dialog.Content className="fixed inset-0 z-[61] flex flex-col outline-none">
          <Dialog.Title className="sr-only">{img?.label ?? "Scan"}</Dialog.Title>
          <Dialog.Description className="sr-only">Pinch or double-tap to zoom. Swipe to see the next image.</Dialog.Description>
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <div>
              <div className="font-display text-[16px] font-semibold">{img?.label}</div>
              <div className="tnum text-[12.5px] text-white/60">
                {index !== null ? index + 1 : 0} of {images.length}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className="flex size-11 items-center justify-center rounded-full hover:bg-white/10" onClick={() => setScale((s) => Math.max(1, s - 0.75))} aria-label="Zoom out">
                <ZoomOut className="size-5" />
              </button>
              <button className="flex size-11 items-center justify-center rounded-full hover:bg-white/10" onClick={() => setScale((s) => Math.min(5, s + 0.75))} aria-label="Zoom in">
                <ZoomIn className="size-5" />
              </button>
              <Dialog.Close className="flex size-11 items-center justify-center rounded-full hover:bg-white/10" aria-label="Close">
                <X className="size-6" />
              </Dialog.Close>
            </div>
          </div>
          <div
            className="relative flex-1 touch-none select-none overflow-hidden"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={(e) => setScale((s) => Math.min(5, Math.max(1, s - e.deltaY * 0.002)))}
          >
            {img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img.url}
                alt={img.label}
                draggable={false}
                className={cn("absolute inset-0 m-auto max-h-full max-w-full object-contain", !dragging && "transition-transform duration-200")}
                style={{ transform: `translate(${tx + swipeX}px, ${ty}px) scale(${scale})` }}
              />
            )}
          </div>
          <div className="flex items-center justify-center gap-3 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
            <button
              onClick={() => go(-1)}
              disabled={!index}
              className="flex size-12 items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-30"
              aria-label="Previous image"
            >
              <ChevronLeft />
            </button>
            <div className="flex gap-1.5">
              {images.map((im, i) => (
                <button
                  key={im.url}
                  onClick={() => onIndexChange(i)}
                  className={cn("h-1.5 rounded-full transition-all", i === index ? "w-6 bg-white" : "w-1.5 bg-white/40")}
                  aria-label={im.label}
                />
              ))}
            </div>
            <button
              onClick={() => go(1)}
              disabled={index === null || index >= images.length - 1}
              className="flex size-12 items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-30"
              aria-label="Next image"
            >
              <ChevronRight />
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
