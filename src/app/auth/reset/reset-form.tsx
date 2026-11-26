"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sb } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function ResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Use at least 8 characters.");
    setBusy(true);
    const { error } = await sb().auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    router.replace("/");
  }

  return (
    <div>
      <div className="label-caps mb-2">Account</div>
      <h1 className="text-[30px] font-bold leading-tight">Choose a new password</h1>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label="New password" htmlFor="pw" hint="At least 8 characters.">
          <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Save password
        </Button>
      </form>
    </div>
  );
}
