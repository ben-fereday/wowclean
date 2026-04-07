"use server";

import { Resend } from "resend";

export async function sendContactMessage(data: {
  name: string;
  email: string;
  phone: string;
  message: string;
}): Promise<{ success?: boolean; error?: string }> {
  if (!data.name.trim() || !data.email.trim() || !data.message.trim()) {
    return { error: "Please fill in all required fields." };
  }

  if (!process.env.RESEND_API_KEY) {
    return { error: "Email service not configured." };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: "WowClean <info@wowcleancalgary.com>",
      to: process.env.ADMIN_EMAIL || "teamwowclean@gmail.com",
      replyTo: data.email,
      subject: `New Contact Message — ${data.name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0b1740;color:#fff;padding:40px;border-radius:12px;">
          <h1 style="color:#5bf3ff;font-size:24px;margin-bottom:16px;">New Contact Message</h1>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#7a8baa;font-size:13px;text-transform:uppercase;letter-spacing:1px;width:100px;">Name</td><td style="padding:8px 0;color:#fff;">${data.name}</td></tr>
            <tr><td style="padding:8px 0;color:#7a8baa;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Email</td><td style="padding:8px 0;color:#5bf3ff;">${data.email}</td></tr>
            ${data.phone ? `<tr><td style="padding:8px 0;color:#7a8baa;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Phone</td><td style="padding:8px 0;color:#fff;">${data.phone}</td></tr>` : ""}
          </table>
          <div style="margin-top:20px;padding:16px;background:rgba(255,255,255,0.05);border-radius:8px;">
            <p style="color:#7a8baa;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Message</p>
            <p style="color:#fff;line-height:1.6;white-space:pre-wrap;">${data.message}</p>
          </div>
          <p style="color:#7a8baa;font-size:12px;margin-top:20px;">Reply directly to this email to respond to ${data.name}.</p>
        </div>
      `,
    });

    return { success: true };
  } catch {
    return { error: "Failed to send message. Please try again." };
  }
}
