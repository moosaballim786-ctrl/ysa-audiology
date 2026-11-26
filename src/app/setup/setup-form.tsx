"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sb } from "@/lib/supabase/client";
import { YsaBadge } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/utils";

/** First-run only: creates Dr Yusuf's account. Disabled automatically once any staff account exists. */
export function SetupForm() {
  const router = useRouter();
  const [name, setName] = useState("Dr Yusuf Suder");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters for the password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data, error } = await sb().functions.invoke("staff-admin", {
        body: { action: "bootstrap", full_name: name.trim(), email: email.trim(), password },
      });
      if (error) {
        let msg = error.message;
        try {
          const j = await (error as { context?: Response }).context?.json();
          if (j?.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }
      if (!data?.ok) throw new Error(data?.error ?? "Setup failed");
      const { error: signErr } = await sb().auth.signInWithPassword({ email: email.trim(), password });
      if (signErr) throw signErr;
      toast.success("Practice set up — welcome, Doctor.");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <YsaBadge className="mb-7 size-14 lg:hidden" />
      <div className="label-caps mb-2">First-time setup</div>
      <h1 className="text-[30px] font-bold leading-tight">Create the doctor&rsquo;s account</h1>
      <p className="mt-2 text-[15px] text-muted">
        This page only works once — before any staff account exists. Other staff are invited later from Settings.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label="Full name" htmlFor="name">
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
          <Input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && <div className="rounded-xl bg-coral-bg px-3.5 py-2.5 text-sm text-coral-text">{error}</div>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Create account
        </Button>
      </form>
    </div>
  );
}
