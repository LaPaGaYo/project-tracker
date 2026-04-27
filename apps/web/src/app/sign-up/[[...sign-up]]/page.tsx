import { SignUp } from "@clerk/nextjs";

import { signInDemoAction } from "@/app/actions";
import { AuthGateway } from "@/features/auth/auth-gateway";
import { isClerkConfigured } from "@/server/auth";

export default function SignUpPage() {
  const clerkConfigured = isClerkConfigured();

  return (
    <AuthGateway mode="sign-up" isClerkConfigured={clerkConfigured} demoAction={signInDemoAction}>
      {clerkConfigured ? <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" /> : null}
    </AuthGateway>
  );
}
