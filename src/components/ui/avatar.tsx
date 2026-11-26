import { cn, initials } from "@/lib/utils";

const palette = [
  "bg-primary-soft text-primary-hover",
  "bg-secondary-soft text-secondary",
  "bg-sage-bg text-sage-text",
  "bg-[#eef1f6] text-[#4b5b78]",
];

export function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  const n = name ?? "";
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full font-display text-[13px] font-semibold",
        palette[h % palette.length],
        className,
      )}
      aria-hidden
    >
      {initials(n)}
    </div>
  );
}
