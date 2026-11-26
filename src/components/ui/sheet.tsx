"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Bottom sheet on phones, centred modal on larger screens. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  wide,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#0f172a]/30 backdrop-blur-[2px] data-[state=open]:animate-[fadeIn_.2s_ease-out]" />
        <Dialog.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[24px] border border-border bg-card shadow-float outline-none",
            "data-[state=open]:animate-[sheetUp_.26s_cubic-bezier(.2,.8,.2,1)]",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[22px] sm:data-[state=open]:animate-[popIn_.2s_ease-out]",
            wide ? "sm:max-w-2xl" : "sm:max-w-lg",
            className,
          )}
        >
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-[#dfe5eb] sm:hidden" />
          <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-4 sm:px-6 sm:pt-6">
            <div>
              <Dialog.Title className="font-display text-lg font-semibold text-heading">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-sm text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="-mr-1 flex size-9 items-center justify-center rounded-full text-muted transition hover:bg-[#eef2f5] hover:text-heading"
              aria-label="Close"
            >
              <X className="size-[18px]" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-5 pt-2 sm:px-6">{children}</div>
          {footer && (
            <div className="pb-safe border-t border-border bg-bg-alt/60 px-5 py-4 sm:rounded-b-[22px] sm:px-6">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
