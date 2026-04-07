"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Circle } from "lucide-react";

function PasswordChecklist({ password }: { password: string }) {
  const rules = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "At least 1 uppercase letter", met: /[A-Z]/.test(password) },
    { label: "At least 1 number", met: /[0-9]/.test(password) },
    {
      label: "At least 1 special character (!@#$%^&* etc)",
      met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password),
    },
  ];

  return (
    <ul className="mt-2 space-y-1 text-sm">
      {rules.map((rule) => (
        <li key={rule.label} className="flex items-center gap-2">
          {rule.met ? (
            <Check className="h-4 w-4 text-[hsl(var(--accent))]" />
          ) : (
            <Circle className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          )}
          <span
            className={
              rule.met
                ? "text-[hsl(var(--accent))]"
                : "text-[hsl(var(--muted-foreground))]"
            }
          >
            {rule.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

function isPasswordValid(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-dark" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/account";
  const urlError = searchParams.get("error");

  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(urlError || "");
  const [successMessage, setSuccessMessage] = useState("");

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Sign up form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    const result = await signIn({
      email: loginEmail,
      password: loginPassword,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.refresh();
      // If there's a specific redirect (e.g. from subscription flow), use that.
      // Otherwise use the role-based redirect from the server.
      const dest = redirectTo !== "/account" ? redirectTo : (result.redirectTo ?? "/account");
      router.push(dest);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!isPasswordValid(signUpPassword)) {
      setError("Password does not meet the requirements.");
      return;
    }

    if (signUpPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const result = await signUp({
      email: signUpEmail,
      password: signUpPassword,
      first_name: firstName,
      last_name: lastName,
      phone,
      redirectTo: redirectTo !== "/account" ? redirectTo : undefined,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else if (result.confirmed) {
      router.refresh();
      router.push(redirectTo);
    } else {
      setSuccessMessage("Check your email to confirm your account.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] px-4 py-12">
      <Card className="w-full max-w-md border-[hsl(var(--muted))] bg-[hsl(var(--card))]">
        <CardHeader className="text-center">
          <CardTitle className="font-[family-name:var(--font-heading)] text-4xl uppercase tracking-wide text-white">
            WowClean
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => { setTab(v); setError(""); setSuccessMessage(""); }}>
            <TabsList className="mb-6 grid w-full grid-cols-2 bg-[hsl(var(--muted))]">
              <TabsTrigger
                value="login"
                className="font-[family-name:var(--font-barlow-condensed)] text-sm uppercase tracking-wider"
              >
                Login
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="font-[family-name:var(--font-barlow-condensed)] text-sm uppercase tracking-wider"
              >
                Sign Up
              </TabsTrigger>
            </TabsList>

            {/* Error / success messages */}
            {error && (
              <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="mb-4 rounded-md border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/10 px-4 py-3 text-sm text-[hsl(var(--accent))]">
                {successMessage}
              </div>
            )}

            {/* Login Tab */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-white">
                    Email
                  </Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="border-[hsl(var(--muted-foreground))]/30 bg-[hsl(var(--background))] text-white placeholder:text-[hsl(var(--muted-foreground))]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-white">
                    Password
                  </Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Your password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="border-[hsl(var(--muted-foreground))]/30 bg-[hsl(var(--background))] text-white placeholder:text-[hsl(var(--muted-foreground))]"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[hsl(var(--primary))] font-[family-name:var(--font-barlow-condensed)] text-base uppercase tracking-wider text-white hover:bg-[hsl(var(--primary))]/80"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            {/* Sign Up Tab */}
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first-name" className="text-white">
                      First Name
                    </Label>
                    <Input
                      id="first-name"
                      type="text"
                      placeholder="First"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="border-[hsl(var(--muted-foreground))]/30 bg-[hsl(var(--background))] text-white placeholder:text-[hsl(var(--muted-foreground))]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name" className="text-white">
                      Last Name
                    </Label>
                    <Input
                      id="last-name"
                      type="text"
                      placeholder="Last"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="border-[hsl(var(--muted-foreground))]/30 bg-[hsl(var(--background))] text-white placeholder:text-[hsl(var(--muted-foreground))]"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-white">
                    Email
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    className="border-[hsl(var(--muted-foreground))]/30 bg-[hsl(var(--background))] text-white placeholder:text-[hsl(var(--muted-foreground))]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-white">
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="border-[hsl(var(--muted-foreground))]/30 bg-[hsl(var(--background))] text-white placeholder:text-[hsl(var(--muted-foreground))]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-white">
                    Password
                  </Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a password"
                    required
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    className="border-[hsl(var(--muted-foreground))]/30 bg-[hsl(var(--background))] text-white placeholder:text-[hsl(var(--muted-foreground))]"
                  />
                  <PasswordChecklist password={signUpPassword} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-white">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm your password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="border-[hsl(var(--muted-foreground))]/30 bg-[hsl(var(--background))] text-white placeholder:text-[hsl(var(--muted-foreground))]"
                  />
                  {confirmPassword && confirmPassword !== signUpPassword && (
                    <p className="text-sm text-red-400">
                      Passwords do not match.
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[hsl(var(--primary))] font-[family-name:var(--font-barlow-condensed)] text-base uppercase tracking-wider text-white hover:bg-[hsl(var(--primary))]/80"
                >
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
