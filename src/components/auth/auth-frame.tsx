import { YsaBadge } from "@/components/brand/logo";

/** Elegant split layout for sign-in / setup screens. */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-[#1f5f6b] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_10%_0%,#3391a2_0%,#226b79_45%,#1b4f5c_100%)]" />
        <svg className="absolute inset-0 h-full w-full opacity-[0.10]" aria-hidden>
          <defs>
            <pattern id="waves" width="120" height="60" patternUnits="userSpaceOnUse">
              <path d="M0 30 Q 30 5 60 30 T 120 30" fill="none" stroke="#fff" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#waves)" />
        </svg>
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <YsaBadge className="size-11 ring-1 ring-white/25 rounded-full" />
            <span className="font-display text-lg font-semibold tracking-tight">Yusuf Suder Audiology</span>
          </div>
          <div className="max-w-md">
            <p className="font-display text-[44px] font-semibold leading-[1.08] tracking-tight">
              We&rsquo;re hear
              <br /> for you.
            </p>
            <p className="mt-5 text-[15px] leading-relaxed text-white/75">
              Bookings, patient history, recalls, scans and takings — calmly in one place, on every device.
            </p>
          </div>
          <div className="flex items-end gap-[5px] opacity-70" aria-hidden>
            {[6, 12, 20, 14, 28, 18, 10, 22, 34, 20, 12, 26, 16, 8, 14, 22, 12, 6].map((h, i) => (
              <span key={i} className="w-[3px] rounded-full bg-white/80" style={{ height: h }} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[400px]">{children}</div>
      </div>
    </div>
  );
}
