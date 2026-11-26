import { AuthFrame } from "@/components/auth/auth-frame";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Set up" };

export default function SetupPage() {
  return (
    <AuthFrame>
      <SetupForm />
    </AuthFrame>
  );
}
