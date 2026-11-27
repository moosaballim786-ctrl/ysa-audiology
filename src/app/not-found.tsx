import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { YsaBadge } from "@/components/brand/logo";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm text-center">
        <YsaBadge className="mx-auto mb-6 size-16" />
        <h1 className="text-[26px] font-bold">This page doesn&rsquo;t exist</h1>
        <p className="mt-2 text-[15px] text-muted">The link may be incomplete. Looking to book an appointment?</p>
        <Link
          href="/book"
          className="mt-7 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-base font-semibold text-white shadow-[0_6px_16px_-6px_rgba(42,127,143,.55)] transition hover:bg-primary-hover"
        >
          <CalendarPlus className="size-5" /> Book an appointment
        </Link>
        <Link href="/" className="mt-4 inline-block text-[14px] font-medium text-secondary hover:underline">
          Staff sign-in
        </Link>
        <p className="mt-10 text-[13px] font-medium text-primary">We&rsquo;re hear for you</p>
      </div>
    </div>
  );
}
