import { SignUp } from "@clerk/nextjs";

import { ClerkAuthSetupHint } from "@/components/ClerkAuthSetupHint";
import { hasClerkConfigured } from "@/lib/clerk/env";

export default function SignUpPage() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-zinc-950 px-4 py-12">
      {hasClerkConfigured() ? (
        <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
      ) : (
        <ClerkAuthSetupHint title="Sign up unavailable" />
      )}
    </div>
  );
}
