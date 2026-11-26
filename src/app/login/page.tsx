import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { AuthFrame } from "@/components/auth/auth-frame";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthFrame>
      <Suspense fallback={<div className="skeleton h-80 w-full" />}>
        <LoginForm />
      </Suspense>
    </AuthFrame>
  );
}
