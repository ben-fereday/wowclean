"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { checkRateLimit } from "@/lib/rate-limit";
import { Resend } from "resend";

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

  // Send welcome email via Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "WowClean <info@wowcleancalgary.com>",
        to: formData.email,
        subject: "Welcome to WOW CLEAN!",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#070d22;border-radius:16px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#1262d4,#1a4aff);padding:32px 40px;text-align:center;">
              <h1 style="color:#fff;font-size:32px;margin:0 0 4px;letter-spacing:2px;font-weight:800;">WOW CLEAN</h1>
              <p style="color:rgba(255,255,255,0.7);font-size:14px;margin:0;letter-spacing:1px;text-transform:uppercase;">Welcome Aboard</p>
            </div>
            <div style="padding:32px 40px;">
              <p style="color:#fff;font-size:18px;margin-bottom:8px;">Hey ${formData.first_name}! 👋</p>
              <p style="color:#7a8baa;font-size:15px;line-height:1.7;margin-bottom:24px;">Thanks for creating your WOW CLEAN account. You're all set to book premium auto detailing in Calgary.</p>
              <div style="background:#0b1740;border-radius:12px;padding:20px;margin-bottom:24px;">
                <p style="color:#7a8baa;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">What you can do now</p>
                <table style="width:100%;border-collapse:collapse;">
                  <tr><td style="padding:6px 0;color:#5bf3ff;font-size:14px;">✦</td><td style="padding:6px 0 6px 8px;color:#fff;font-size:14px;">Book a one-time detail</td></tr>
                  <tr><td style="padding:6px 0;color:#5bf3ff;font-size:14px;">✦</td><td style="padding:6px 0 6px 8px;color:#fff;font-size:14px;">Subscribe for recurring service</td></tr>
                  <tr><td style="padding:6px 0;color:#5bf3ff;font-size:14px;">✦</td><td style="padding:6px 0 6px 8px;color:#fff;font-size:14px;">Manage your appointments online</td></tr>
                </table>
              </div>
              <div style="text-align:center;margin-bottom:24px;">
                <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://wowcleancalgary.com"}/book" style="display:inline-block;background:linear-gradient(135deg,#1262d4,#1a4aff);color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;letter-spacing:1px;text-transform:uppercase;">Book Your First Detail</a>
              </div>
              <div style="padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
                <p style="color:#7a8baa;font-size:13px;line-height:1.6;margin:0;">Questions? Call <a href="tel:+15878913265" style="color:#5bf3ff;text-decoration:none;">(587) 891-3265</a> or email <a href="mailto:teamwowclean@gmail.com" style="color:#5bf3ff;text-decoration:none;">teamwowclean@gmail.com</a></p>
              </div>
            </div>
          </div>
        `,
      });
    } catch {
      // Don't fail signup if email fails
    }
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
