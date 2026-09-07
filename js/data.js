export function validateCatalog(data) {
  if (data?.schemaVersion !== 1 || !Array.isArray(data.tutors) || !data.timeZone) throw new Error("Invalid tutor catalog.");
  new Intl.DateTimeFormat("en-US", { timeZone: data.timeZone }).format();
  const tutors = new Set(), slots = new Set();
  const validId = value => typeof value === "string" && /^[a-z0-9-]+$/.test(value);
  for (const tutor of data.tutors) {
    if (!validId(tutor.id) || tutors.has(tutor.id) || typeof tutor.name !== "string" || !tutor.name.trim() || !Array.isArray(tutor.subjects) || !tutor.subjects.length || !tutor.subjects.every(s => typeof s === "string" && s.trim()) || !Array.isArray(tutor.grades) || !tutor.grades.length || !tutor.grades.every(g => Number.isInteger(g) && g >= 0 && g <= 12) || !Array.isArray(tutor.availability)) throw new Error("Invalid tutor information.");
    tutors.add(tutor.id);
    for (const slot of tutor.availability) {
      if (!validId(slot.id) || slots.has(slot.id) || !Number.isFinite(Date.parse(slot.start)) || !Number.isFinite(Date.parse(slot.end)) || Date.parse(slot.end) <= Date.parse(slot.start) || !/(Z|[+-]\d{2}:\d{2})$/.test(slot.start) || !/(Z|[+-]\d{2}:\d{2})$/.test(slot.end)) throw new Error("Invalid availability.");
      slots.add(slot.id);
    }
  }
  return data;
}

export function availableSlots(tutor, bookings, now = Date.now()) {
  const reserved = new Set(bookings.map(booking => booking.slotId));
  return tutor.availability.filter(slot => Date.parse(slot.start) > now && !reserved.has(slot.id)).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

export function formatSlot(slot, timeZone) {
  const date = new Date(slot.start), end = new Date(slot.end);
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  return {
    date: new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(date),
    time: `${time.format(date)} – ${time.format(end)}`,
    zone: new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(date).find(part => part.type === "timeZoneName").value,
  };
}

export function gradeLabel(grade) { return grade === 0 ? "K" : String(grade); }
export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
