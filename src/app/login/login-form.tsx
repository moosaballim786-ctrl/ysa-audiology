"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { sb } from "@/lib/supabase/client";
import { YsaBadge } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setError(error.message === "Invalid login credentials" ? "That email and password don't match." : error.message);
      return;
    }
    const next = params.get("next");
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  async function forgot() {
    if (!email.trim()) {
      setError("Enter your email above first, then tap “Forgot password”.");
      return;
    }
    const { error } = await sb().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    if (error) toast.error(error.message);
    else toast.success("Check your email for a reset link.");
  }

  return (
    <div>
      <YsaBadge className="mb-7 size-14 lg:hidden" />
      <div className="label-caps mb-2">Staff sign in</div>
      <h1 className="text-[30px] font-bold leading-tight">Welcome back</h1>
      <p className="mt-2 text-[15px] text-muted">Sign in to Yusuf Suder Audiology.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:text-heading"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          </div>
        </Field>
        {error && <div className="rounded-xl bg-coral-bg px-3.5 py-2.5 text-sm text-coral-text">{error}</div>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Sign in
        </Button>
        <div className="flex items-center justify-between pt-1 text-sm">
          <button type="button" onClick={forgot} className="font-medium text-secondary hover:underline">
            Forgot password?
          </button>
          <Link href="/book" className="text-muted hover:text-heading">
            Patient booking →
          </Link>
        </div>
      </form>
      <p className="mt-10 text-[13px] text-muted">
        Accounts are by invitation only. First time here?{" "}
        <Link href="/setup" className="font-medium text-secondary hover:underline">
          Set up the practice
        </Link>
      </p>
    </div>
  );
}
