"use client";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-[28px] w-[48px] shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-[#dfe5eb] transition-colors data-[state=checked]:bg-primary disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-[22px] translate-x-[2px] rounded-full bg-white shadow-[0_1px_3px_rgba(17,24,39,.2)] transition-transform duration-200 data-[state=checked]:translate-x-[22px]" />
    </SwitchPrimitive.Root>
  );
}
