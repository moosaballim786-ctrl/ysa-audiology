"use client";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all duration-200 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-white shadow-[0_1px_2px_rgba(17,24,39,.08),0_6px_16px_-6px_rgba(42,127,143,.55)] hover:bg-primary-hover hover:-translate-y-px",
        secondary:
          "border border-border bg-card text-heading shadow-[0_1px_2px_rgba(17,24,39,.04)] hover:-translate-y-px hover:border-[#d5dde5] hover:shadow-soft",
        soft: "bg-primary-soft text-primary-hover hover:bg-[#dcedf0]",
        ghost: "text-text hover:bg-[#eef2f5]",
        sage: "bg-sage text-white shadow-[0_6px_16px_-8px_rgba(78,154,120,.7)] hover:brightness-[.95] hover:-translate-y-px",
        coral: "bg-coral-bg text-coral-text hover:bg-[#f7dfdc]",
        destructive: "bg-crimson text-white hover:brightness-95",
        link: "text-secondary underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-[15px]",
        lg: "h-12 px-5 text-base",
        xl: "h-14 px-6 text-base rounded-2xl",
        icon: "h-11 w-11",
        "icon-sm": "h-9 w-9 rounded-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    if (asChild) {
      return (
        <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
          {children}
        </Comp>
      );
    }
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
