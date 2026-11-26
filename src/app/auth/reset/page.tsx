import { AuthFrame } from "@/components/auth/auth-frame";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Reset password" };

export default function ResetPage() {
  return (
    <AuthFrame>
      <ResetForm />
    </AuthFrame>
  );
}
