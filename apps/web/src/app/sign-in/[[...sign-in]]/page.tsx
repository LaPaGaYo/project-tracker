import { SignIn } from "@clerk/nextjs";

import { signInDemoAction } from "@/app/actions";
import { AuthGateway } from "@/features/auth/auth-gateway";
import { isClerkConfigured } from "@/server/auth";

export default function SignInPage() {
  const clerkConfigured = isClerkConfigured();

  return (
    <AuthGateway mode="sign-in" isClerkConfigured={clerkConfigured} demoAction={signInDemoAction}>
      {clerkConfigured ? <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" /> : null}
    </AuthGateway>
  );
}
