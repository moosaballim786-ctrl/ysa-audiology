import { useId } from "react";
import { cn } from "@/lib/utils";

/** YSA monogram badge — teal disc, refined lettering, subtle sound-wave motif. */
export function YsaBadge({ className, title = "Yusuf Suder Audiology" }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={title} className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3391A2" />
          <stop offset="1" stopColor="#226B79" />
        </linearGradient>
        <radialGradient id={`h${id}`} cx="0.3" cy="0.2" r="0.9">
          <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="60" fill={`url(#g${id})`} />
      <circle cx="60" cy="60" r="60" fill={`url(#h${id})`} />
      <circle cx="60" cy="60" r="53.5" fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="1" />
      <g fill="#FBFCFC">
        <path transform="translate(24.486 66)" d="M8.646 0.0V-10.89L0.363 -24.585H5.478000000000001L11.814 -13.893H9.999L16.302 -24.585H21.417L13.167 -10.923V0.0ZM35.134 0.396Q32.791 0.396 30.7945 -0.462Q28.798000000000002 -1.32 27.3625 -2.8545000000000003Q25.927 -4.389 25.267 -6.4350000000000005L28.996000000000002 -8.052Q29.887 -5.94 31.57 -4.7355Q33.253 -3.531 35.365 -3.531Q36.553 -3.531 37.427499999999995 -3.9105Q38.302 -4.29 38.7805 -4.95Q39.259 -5.61 39.259 -6.534000000000001Q39.259 -7.623 38.6155 -8.3325Q37.972 -9.042 36.685 -9.438L31.966 -10.956000000000001Q29.095 -11.847000000000001 27.643 -13.629000000000001Q26.191000000000003 -15.411000000000001 26.191000000000003 -17.82Q26.191000000000003 -19.932000000000002 27.2305 -21.549Q28.27 -23.166 30.134500000000003 -24.073500000000003Q31.999000000000002 -24.981 34.408 -24.981Q36.619 -24.981 38.467 -24.2055Q40.315 -23.43 41.6515 -22.0605Q42.988 -20.691000000000003 43.647999999999996 -18.843L39.952 -17.193Q39.226 -19.041 37.774 -20.0475Q36.322 -21.054000000000002 34.408 -21.054000000000002Q33.286 -21.054000000000002 32.428 -20.674500000000002Q31.57 -20.295 31.0915 -19.6185Q30.613 -18.942 30.613 -18.018Q30.613 -16.995 31.273 -16.2195Q31.933 -15.444 33.286 -15.015L37.807 -13.596Q40.744 -12.639000000000001 42.2125 -10.956Q43.681 -9.273 43.681 -6.798Q43.681 -4.686 42.592 -3.069Q41.503 -1.452 39.589 -0.528Q37.675 0.396 35.134 0.396ZM47.894000000000005 0.0 56.37500000000001 -24.585H62.18300000000001L70.66400000000002 0.0H65.78L64.031 -5.28H54.52700000000001L52.745000000000005 0.0ZM55.81400000000001 -9.24H62.74400000000001L58.65200000000001 -21.483H59.906000000000006Z"/><g opacity={0.72}><rect x="32.50" y="82.50" width="2.2" height="3" rx="1.1"/><rect x="37.30" y="81.00" width="2.2" height="6" rx="1.1"/><rect x="42.10" y="79.00" width="2.2" height="10" rx="1.1"/><rect x="46.90" y="76.50" width="2.2" height="15" rx="1.1"/><rect x="51.70" y="79.50" width="2.2" height="9" rx="1.1"/><rect x="56.50" y="74.50" width="2.2" height="19" rx="1.1"/><rect x="61.30" y="78.00" width="2.2" height="12" rx="1.1"/><rect x="66.10" y="80.50" width="2.2" height="7" rx="1.1"/><rect x="70.90" y="77.00" width="2.2" height="14" rx="1.1"/><rect x="75.70" y="80.00" width="2.2" height="8" rx="1.1"/><rect x="80.50" y="81.50" width="2.2" height="5" rx="1.1"/><rect x="85.30" y="82.50" width="2.2" height="3" rx="1.1"/></g>
      </g>
    </svg>
  );
}

/** Wordmark: badge + practice name + tagline ("hear" is deliberate). */
export function YsaWordmark({
  className,
  size = "md",
  showTagline = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
}) {
  const badge = { sm: "h-9 w-9", md: "h-12 w-12", lg: "h-16 w-16" }[size];
  const name = { sm: "text-[15px]", md: "text-lg", lg: "text-2xl" }[size];
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <YsaBadge className={badge} />
      <div className="leading-tight">
        <div className={cn("font-display font-semibold tracking-tight text-heading", name)}>Yusuf Suder Audiology</div>
        {showTagline && <div className="mt-0.5 text-[13px] font-medium text-primary">We&rsquo;re hear for you</div>}
      </div>
    </div>
  );
}
