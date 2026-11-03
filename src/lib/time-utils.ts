import { bookingTimesConflict, parseBookingTime } from "@/lib/booking-schedule";

export function isTimeBlocked(time: string, bookedTimes: string[]): boolean {
  if (parseBookingTime(time) === null) return true;
  return bookedTimes.some((booked) => bookingTimesConflict(booked, time));
}
