import { getSiteSettings } from "@/lib/site-settings";
import { RegisterFormWithSuspense } from "@/components/auth/register-form";
import { SignupClosedNotice } from "@/components/auth/signup-closed-notice";

/**
 * Server wrapper — checks signup_open before rendering the (client-side)
 * registration form. Signup itself runs entirely client-side via
 * supabase.auth.signUp(), so gating happens here at the render level:
 * if the form never renders, no signup can happen through this page.
 */
export default async function RegisterPage() {
  const settings = await getSiteSettings();
  const signupOpen = settings.signup_open !== "off";

  if (!signupOpen) {
    return <SignupClosedNotice />;
  }

  return <RegisterFormWithSuspense />;
}
