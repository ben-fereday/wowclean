"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import type { BookingStatus } from "@/lib/constants";

async function verifyAdminOrOwner(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "owner"].includes(profile.role)) {
    throw new Error("Unauthorized");
  }

  return { user, role: profile.role };
}

async function verifyOwner(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { user, role } = await verifyAdminOrOwner(supabase);
  if (role !== "owner") throw new Error("Only the owner can perform this action");
  return { user, role };
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus
) {
  const supabase = await createClient();
  await verifyAdminOrOwner(supabase);

  // Update the booking status first
  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", bookingId);

  if (error) throw new Error(error.message);

  // Send cancellation email if status is cancelled
  if (status === "cancelled" && process.env.RESEND_API_KEY) {
    // Re-fetch the booking after update to get all fields
    const { data: booking, error: fetchErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (fetchErr || !booking) {
      console.error("Failed to fetch booking for cancel email:", fetchErr);
      revalidatePath("/admin");
      return;
    }

    // Get customer name
    let name = booking.guest_first_name || "Customer";
    if (booking.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", booking.user_id)
        .single();
      if (profile?.first_name) name = profile.first_name;
    }

    // Get email: guest_email is always set (even for logged-in users)
    let email: string | null = booking.guest_email;

    if (!email && booking.user_id) {
      try {
        const { data: userData } = await supabase.rpc("find_user_by_email_id", {
          user_id_input: booking.user_id,
        }) as { data: { id: string; email: string }[] | null };
        if (userData && userData.length > 0) email = userData[0].email;
      } catch (rpcErr) {
        // RPC may not exist yet — try get_customer_emails as fallback
        console.error("find_user_by_email_id RPC failed, trying fallback:", rpcErr);
        try {
          const { data: allEmails } = await supabase.rpc("get_customer_emails") as {
            data: { id: string; email: string }[] | null;
          };
          if (allEmails) {
            const match = allEmails.find((e) => e.id === booking.user_id);
            if (match) email = match.email;
          }
        } catch {
          console.error("Fallback email lookup also failed");
        }
      }
    }

    if (email) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const dateStr = new Date(booking.booking_date + "T12:00:00").toLocaleDateString("en-US", {
          weekday: "long", month: "long", day: "numeric", year: "numeric",
        });

        await resend.emails.send({
          from: "WowClean <info@wowcleancalgary.com>",
          to: email,
          subject: `Booking Cancelled — ${booking.reference_code}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#070d22;border-radius:16px;overflow:hidden;">
              <div style="background:linear-gradient(135deg,#c62828,#e53935);padding:32px 40px;text-align:center;">
                <h1 style="color:#fff;font-size:32px;margin:0 0 4px;letter-spacing:2px;font-weight:800;">WOW CLEAN</h1>
                <p style="color:rgba(255,255,255,0.7);font-size:14px;margin:0;letter-spacing:1px;text-transform:uppercase;">Booking Cancelled</p>
              </div>
              <div style="padding:32px 40px;">
                <div style="text-align:center;margin-bottom:24px;">
                  <div style="display:inline-block;background:rgba(245,197,24,0.1);border:1px solid rgba(245,197,24,0.2);border-radius:8px;padding:8px 20px;">
                    <span style="color:#7a8baa;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Reference Code</span><br/>
                    <span style="color:#f5c518;font-size:20px;font-weight:bold;letter-spacing:2px;">${booking.reference_code}</span>
                  </div>
                </div>
                <p style="color:#fff;font-size:16px;margin-bottom:16px;">Hi ${name},</p>
                <p style="color:#7a8baa;font-size:15px;line-height:1.7;margin-bottom:24px;">Your booking on <strong style="color:#fff;">${dateStr}</strong> at <strong style="color:#fff;">${booking.booking_time}</strong> has been cancelled.</p>
                <p style="color:#7a8baa;font-size:14px;line-height:1.7;margin-bottom:24px;">We'd love to rebook you at a time that works! You can book a new appointment online anytime.</p>
                <div style="text-align:center;margin-bottom:24px;">
                  <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://wowcleancalgary.com"}/book" style="display:inline-block;background:linear-gradient(135deg,#1262d4,#1a4aff);color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;letter-spacing:1px;text-transform:uppercase;">Rebook Now</a>
                </div>
                <div style="padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
                  <p style="color:#7a8baa;font-size:13px;line-height:1.6;margin:0;">Questions? Call <a href="tel:+15878913265" style="color:#5bf3ff;text-decoration:none;">(587) 891-3265</a> or email <a href="mailto:teamwowclean@gmail.com" style="color:#5bf3ff;text-decoration:none;">teamwowclean@gmail.com</a></p>
                </div>
              </div>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Cancel email error:", emailError);
      }
    }
  }

  revalidatePath("/admin");
}

export async function deleteGalleryImage(imageId: string, filePath: string) {
  const supabase = await createClient();
  await verifyAdminOrOwner(supabase);

  const { error: storageError } = await supabase.storage
    .from("gallery")
    .remove([filePath]);

  if (storageError) throw new Error(storageError.message);

  const { error: dbError } = await supabase
    .from("gallery_images")
    .delete()
    .eq("id", imageId);

  if (dbError) throw new Error(dbError.message);
  revalidatePath("/admin");
}

export async function updateUserRole(email: string, newRole: "admin" | "customer") {
  const supabase = await createClient();
  await verifyOwner(supabase);

  const { data: authUsers, error: authError } = await supabase
    .rpc("find_user_by_email", { search_email: email });

  if (authError || !authUsers || authUsers.length === 0) {
    return { error: `No account found for ${email}. Make sure they've signed up first.` };
  }

  const userId = authUsers[0].id;

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (targetProfile?.role === "owner") {
    return { error: "Cannot change the owner's role." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

export async function revokeAdmin(userId: string) {
  const supabase = await createClient();
  await verifyOwner(supabase);

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (targetProfile?.role === "owner") {
    return { error: "Cannot revoke the owner's role." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: "customer" })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

// ─── Blocked Slots ───

export async function blockTimeSlot(data: {
  date: string;
  time?: string; // null/undefined = block whole day
  reason?: string;
}) {
  const supabase = await createClient();
  const { user } = await verifyAdminOrOwner(supabase);

  const { error } = await supabase.from("blocked_slots").insert({
    blocked_date: data.date,
    blocked_time: data.time || null,
    reason: data.reason || null,
    created_by: user.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

export async function unblockSlot(slotId: string) {
  const supabase = await createClient();
  await verifyAdminOrOwner(supabase);

  const { error } = await supabase
    .from("blocked_slots")
    .delete()
    .eq("id", slotId);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

export async function getBlockedSlots() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blocked_slots")
    .select("*")
    .order("blocked_date", { ascending: true });
  return data ?? [];
}

// ─── Promo Codes ───

export interface PromoCodeRow {
  id: string;
  code: string;
  discount_pct: number;
  scope: "booking" | "subscription";
  max_uses_per_user: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export async function listPromoCodes(): Promise<PromoCodeRow[]> {
  const supabase = await createClient();
  await verifyAdminOrOwner(supabase);

  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .order("scope", { ascending: true })
    .order("code", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as PromoCodeRow[]) ?? [];
}

export async function createPromoCode(input: {
  code: string;
  discount_pct: number;
  scope: "booking" | "subscription";
  max_uses_per_user: number | null;
  active: boolean;
}) {
  const supabase = await createClient();
  await verifyAdminOrOwner(supabase);

  const code = input.code.trim().toUpperCase();
  if (!code) return { error: "Code is required." };
  if (input.discount_pct <= 0 || input.discount_pct > 100) {
    return { error: "Discount must be between 1 and 100." };
  }

  const { error } = await supabase.from("promo_codes").insert({
    code,
    discount_pct: input.discount_pct,
    scope: input.scope,
    max_uses_per_user: input.max_uses_per_user,
    active: input.active,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `${code} already exists for ${input.scope}.` };
    }
    return { error: error.message };
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function updatePromoCode(
  id: string,
  patch: Partial<{
    discount_pct: number;
    active: boolean;
    max_uses_per_user: number | null;
  }>
) {
  const supabase = await createClient();
  await verifyAdminOrOwner(supabase);

  if (
    patch.discount_pct !== undefined &&
    (patch.discount_pct <= 0 || patch.discount_pct > 100)
  ) {
    return { error: "Discount must be between 1 and 100." };
  }

  const { error } = await supabase
    .from("promo_codes")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

export async function deletePromoCode(id: string) {
  const supabase = await createClient();
  await verifyAdminOrOwner(supabase);

  const { error } = await supabase.from("promo_codes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

export async function resetUserPromoHistory(userId: string) {
  const supabase = await createClient();
  await verifyAdminOrOwner(supabase);

  const { error } = await supabase
    .from("promo_redemptions")
    .delete()
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}
