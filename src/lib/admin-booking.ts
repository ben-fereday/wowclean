export type PaymentStatus = "unpaid" | "paid";
export type PaymentMethod = "credit" | "debit" | "cash" | "e_transfer";
export interface BookingAdminDetails {
  booking_id: string;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  final_amount: number | null;
  internal_notes: string;
  updated_at: string;
}

export function parseFinalAmount(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(value.trim())) throw new Error("Enter a valid amount with up to two decimal places.");
  const amount = Number(value);
  if (amount > 999999.99) throw new Error("Amount is too large.");
  return amount;
}

export function validateTimeRange(date: string, start?: string, end?: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Choose a valid date.");
  const parsed = new Date(date + "T12:00:00Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error("Choose a valid date.");
  if (!start && !end) return;
  if (!start || !end || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || end <= start)
    throw new Error("End time must be after start time on the same date.");
}
