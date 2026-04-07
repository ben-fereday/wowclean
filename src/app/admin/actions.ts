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

  // Get booking details before updating (for email notification)
  const { data: booking } = await supabase
    .from("bookings")
    .select("*, profiles(first_name, last_name)")
    .eq("id", bookingId)
    .single();

  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", bookingId);

  if (error) throw new Error(error.message);

  // Send cancellation email if status is cancelled
  if (status === "cancelled" && booking) {
    const email = booking.guest_email;
    const name = booking.profiles
      ? `${booking.profiles.first_name}`
      : booking.guest_first_name || "Customer";

    if (email && process.env.RESEND_API_KEY) {
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
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0b1740;color:#fff;padding:40px;border-radius:12px;">
              <h1 style="color:#f5c518;font-size:28px;margin-bottom:8px;">Booking Cancelled</h1>
              <p style="color:#7a8baa;margin-bottom:24px;">Reference: <strong style="color:#fff;">${booking.reference_code}</strong></p>
              <p style="color:#fff;margin-bottom:16px;">Hi ${name},</p>
              <p style="color:#7a8baa;margin-bottom:16px;">Your booking on <strong style="color:#fff;">${dateStr}</strong> at <strong style="color:#fff;">${booking.booking_time}</strong> has been cancelled.</p>
              <p style="color:#7a8baa;font-size:13px;line-height:1.6;">If you have questions, please contact WOW CLEAN. We'd love to rebook you at a time that works!</p>
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
