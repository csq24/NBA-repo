import { SignIn } from "@clerk/nextjs";

import { ClerkAuthSetupHint } from "@/components/ClerkAuthSetupHint";
import { hasClerkConfigured } from "@/lib/clerk/env";

export default function SignInPage() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-zinc-950 px-4 py-12">
      {hasClerkConfigured() ? (
        <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
      ) : (
        <ClerkAuthSetupHint title="Sign in unavailable" />
      )}
    </div>
  );
}
