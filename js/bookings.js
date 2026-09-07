export const STORAGE_KEY = "abc-tutoring.bookings.v1";

export function readBookings(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const bookings = JSON.parse(raw);
    if (!Array.isArray(bookings) || !bookings.every(b => b && typeof b.id === "string" && typeof b.tutorId === "string" && typeof b.slotId === "string" && typeof b.parentEmail === "string" && Number.isInteger(b.studentGrade))) throw new Error();
    return bookings;
  } catch {
    throw new Error("Saved bookings couldn’t be read. Please allow browser storage or try your usual browser. Your existing data hasn’t been changed.");
  }
}

export async function saveBooking(catalog, input, { storage = globalThis.localStorage, locks = globalThis.navigator?.locks, now = () => Date.now(), makeId = () => globalThis.crypto.randomUUID() } = {}) {
  const save = () => {
    const tutor = catalog.tutors.find(t => t.id === input.tutorId);
    const slot = tutor?.availability.find(s => s.id === input.slotId);
    if (!slot || Date.parse(slot.start) <= now()) throw new Error("That time is no longer available. Please choose another session.");
    const email = String(input.parentEmail ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Please enter a valid parent email address.");
    if (!tutor.grades.includes(input.studentGrade)) throw new Error("Please select a grade supported by this tutor.");
    const bookings = readBookings(storage);
    if (bookings.some(b => b.slotId === slot.id)) throw new Error("That time was just booked in this browser. Please choose another session.");
    const booking = { id: makeId(), tutorId: tutor.id, slotId: slot.id, parentEmail: email, studentGrade: input.studentGrade, createdAt: new Date(now()).toISOString() };
    try { storage.setItem(STORAGE_KEY, JSON.stringify([...bookings, booking])); }
    catch { throw new Error("Your booking couldn’t be saved. Please allow browser storage and try again."); }
    return booking;
  };
  // Serialize writes between same-origin tabs when Web Locks is supported.
  return locks?.request ? locks.request(STORAGE_KEY, save) : save();
}
