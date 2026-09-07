import { config } from "./config.js";
import { formatSlot, gradeLabel } from "./data.js";

// Call after the booking is successfully saved locally.
// Replace this adapter with an external delivery integration when needed.
export async function sendBookingNotification(booking, { tutor, slot, timeZone } = {}) {
  if (!booking?.id) throw new Error("A saved booking ID is required.");
  if (config.notifications.mode !== "stub") {
    throw new Error("Only stub notifications are implemented.");
  }

  const session = slot && timeZone ? formatSlot(slot, timeZone) : null;
  const message = {
    to: config.notifications.recipientEmail || "[Dana’s email not configured]",
    from: config.notifications.senderEmail || "[Sender email not configured]",
    subject: `New ABC Tutoring booking${tutor ? ` with ${tutor.name}` : ""}`,
    body: [
      "Hi Dana,",
      "",
      "A tutoring session has been booked.",
      `Tutor: ${tutor?.name ?? booking.tutorId}`,
      `Session: ${session ? `${session.date}, ${session.time} ${session.zone}` : booking.slotId}`,
      `Parent email: ${booking.parentEmail}`,
      `Student grade: ${gradeLabel(booking.studentGrade)}`,
      `Booking reference: ${booking.id}`,
      "",
      "ABC Tutoring",
    ].join("\n"),
  };

  // Intentional developer preview only. Never pass this payload to analytics.
  console.info("[EMAIL STUB — not sent]", message);
  return {
    status: "stubbed",
    delivered: false,
    bookingId: booking.id,
    recipientConfigured: Boolean(config.notifications.recipientEmail),
    message,
  };
}
