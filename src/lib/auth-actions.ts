"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { checkRateLimit } from "@/lib/rate-limit";

export async function signUp(formData: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  redirectTo?: string;
}): Promise<{ error?: string; success?: boolean; confirmed?: boolean }> {
  const rateCheck = checkRateLimit(`signup:${formData.email.toLowerCase()}`);
  if (!rateCheck.allowed) {
    return { error: `Too many attempts. Try again in ${rateCheck.retryAfterSeconds} seconds.` };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
      },
      emailRedirectTo: formData.redirectTo
        ? `${process.env.NEXT_PUBLIC_SITE_URL || ""}/auth/callback?next=${encodeURIComponent(formData.redirectTo)}`
        : undefined,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // If user is auto-confirmed (no email confirmation required), session is active
  const confirmed = !!data.session;
  return { success: true, confirmed };
}

export async function signIn(formData: {
  email: string;
  password: string;
}): Promise<{ error?: string; success?: boolean; redirectTo?: string }> {
  const rateCheck = checkRateLimit(`signin:${formData.email.toLowerCase()}`);
  if (!rateCheck.allowed) {
    return { error: `Too many attempts. Try again in ${rateCheck.retryAfterSeconds} seconds.` };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  });

  if (error) {
    return { error: error.message };
  }

  // Check role to determine default redirect
  if (data.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profile && ["admin", "owner"].includes(profile.role)) {
      return { success: true, redirectTo: "/admin" };
    }
  }

  return { success: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
