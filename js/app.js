import "./components.js";
import { config } from "./config.js";
import { validateCatalog, availableSlots } from "./data.js";
import { readBookings, saveBooking, STORAGE_KEY } from "./bookings.js";
import { sendBookingNotification } from "./notifications.js";
import { analytics } from "./analytics.js";

const list = document.querySelector("#tutor-list");
const filters = document.querySelector("#subject-filters");
const form = document.querySelector("booking-form");
const count = document.querySelector("#results-count");
const storageError = document.querySelector("#storage-error");
let catalog, bookings = [], subject = "All subjects", selection = null, saving = false, storageReady = true;
const viewed = new Set(), started = new Set(), visibilityTimers = new Map();
let observer;

analytics.init();

function refreshBookings() {
  try {
    bookings = readBookings();
    storageReady = true;
    storageError.hidden = true;
  } catch (error) {
    storageReady = false;
    storageError.textContent = error.message;
    storageError.hidden = false;
  }
}

function stopWatching() {
  observer?.disconnect();
  visibilityTimers.forEach(clearTimeout);
  visibilityTimers.clear();
}

function watchTutors() {
  stopWatching();
  if (!("IntersectionObserver" in window) || document.hidden) return;
  observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const card = entry.target;
      const id = card.model.tutor.id;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && !viewed.has(id) && !visibilityTimers.has(id)) {
        visibilityTimers.set(id, setTimeout(() => {
          visibilityTimers.delete(id);
          if (!card.isConnected || document.hidden || viewed.has(id)) return;
          viewed.add(id);
          analytics.track("tutor_viewed", { tutor_id: id });
          observer.unobserve(card);
        }, 1000));
      } else if (!entry.isIntersecting || entry.intersectionRatio < 0.5) {
        clearTimeout(visibilityTimers.get(id));
        visibilityTimers.delete(id);
      }
    }
  }, { threshold: [0, 0.5] });
  list.querySelectorAll("tutor-card").forEach(card => observer.observe(card));
}

function renderTutors() {
  if (!catalog) return;
  const activeSlot = document.activeElement?.name === "session-slot" ? document.activeElement.value : null;
  list.replaceChildren();
  const tutors = catalog.tutors.filter(tutor => subject === "All subjects" || tutor.subjects.includes(subject));
  count.textContent = `${tutors.length} ${tutors.length === 1 ? "tutor" : "tutors"}`;
  for (const tutor of tutors) {
    const card = document.createElement("tutor-card");
    card.details = { tutor, slots: storageReady ? availableSlots(tutor, bookings) : [], timeZone: catalog.timeZone, selectedSlot: selection?.slotId, index: catalog.tutors.indexOf(tutor) };
    list.append(card);
  }
  if (!tutors.length) {
    const empty = document.createElement("p");
    empty.className = "empty-list";
    empty.textContent = "No tutors are listed for this subject yet.";
    list.append(empty);
  }
  watchTutors();
  if (activeSlot) list.querySelector(`input[value="${CSS.escape(activeSlot)}"]`)?.focus({ preventScroll: true });
}

function chooseSlot(tutorId, slotId, moveFocus = true) {
  if (saving) return false;
  refreshBookings();
  const tutor = catalog?.tutors.find(t => t.id === tutorId);
  const slot = tutor && availableSlots(tutor, bookings).find(s => s.id === slotId);
  if (!storageReady || !slot) {
    form.showError("That session is no longer available. Please choose another time.");
    renderTutors();
    return false;
  }
  selection = { tutorId, slotId };
  if (!started.has(tutorId)) {
    started.add(tutorId);
    analytics.track("booking_started", { tutor_id: tutorId, ...(subject === "All subjects" ? {} : { subject }) });
  }
  analytics.track("slot_selected", { tutor_id: tutorId, slot_id: slotId });
  form.select(tutor, slot, catalog.timeZone);
  // Update selection without replacing radios: arrow-key navigation stays native.
  list.querySelectorAll("tutor-card").forEach(card => {
    card.querySelector("article").classList.toggle("is-selected", card.model.tutor.id === tutorId);
    card.querySelectorAll('input[name="session-slot"]').forEach(input => { input.checked = input.value === slotId; });
  });
  // On narrow screens, the form is below the list. Keyboard users stay in the radio group.
  if (moveFocus && window.matchMedia("(max-width: 760px)").matches) {
    form.scrollIntoView({ block: "start", behavior: "instant" });
    form.querySelector("h2").focus({ preventScroll: true });
  }
  return true;
}

list.addEventListener("slot-chosen", event => chooseSlot(event.detail.tutorId, event.detail.slotId, !keyboardSelecting));
let keyboardSelecting = false;
list.addEventListener("keydown", () => { keyboardSelecting = true; });
list.addEventListener("pointerdown", () => { keyboardSelecting = false; });

form.addEventListener("booking-requested", async event => {
  if (saving || !selection) return;
  saving = true;
  form.setBusy(true);
  const input = event.detail;
  try {
    const booking = await saveBooking(catalog, input);
    const tutor = catalog.tutors.find(t => t.id === booking.tutorId);
    const slot = tutor.availability.find(s => s.id === booking.slotId);
    selection = null;
    refreshBookings();
    renderTutors();
    form.confirm(booking, tutor, slot, catalog.timeZone);
    analytics.track("booking_completed", { tutor_id: tutor.id, slot_id: slot.id, storage_mode: "local" });
    // Delivery is independent of successful persistence and confirmation.
    void sendBookingNotification(booking, { tutor, slot, timeZone: catalog.timeZone }).catch(() => {});
  } catch (error) {
    refreshBookings();
    renderTutors();
    form.showError(error.message);
  } finally { saving = false; }
});

form.addEventListener("book-another", () => {
  selection = null;
  renderTutors();
  const target = list.querySelector("input") ?? document.querySelector("h1");
  target.setAttribute("tabindex", "0");
  target.focus();
});

filters.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button || saving || button.dataset.subject === subject) return;
  subject = button.dataset.subject;
  filters.querySelectorAll("button").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
  analytics.track("subject_selected", { subject });
  // Clear selection when the selected tutor is excluded by the filter.
  if (selection && subject !== "All subjects" && !catalog.tutors.find(t => t.id === selection.tutorId)?.subjects.includes(subject)) {
    selection = null;
    form.renderPlaceholder();
  }
  renderTutors();
});

function reconcileAvailability() {
  if (!catalog || saving) return;
  refreshBookings();
  if (selection) {
    const tutor = catalog.tutors.find(t => t.id === selection.tutorId);
    if (!storageReady || !availableSlots(tutor, bookings).some(s => s.id === selection.slotId)) {
      form.showError("That session is no longer available. Please choose another time.");
      selection = null;
      form.querySelector('button[type="submit"]')?.setAttribute("disabled", "");
    }
  }
  renderTutors();
}
window.addEventListener("storage", event => { if (event.key === STORAGE_KEY || event.key === null) reconcileAvailability(); });
window.addEventListener("focus", reconcileAvailability);
document.addEventListener("visibilitychange", () => { if (document.hidden) stopWatching(); else reconcileAvailability(); });
setInterval(reconcileAvailability, 60_000);

async function loadTutors() {
  document.querySelector("#load-error").hidden = true;
  count.textContent = "Loading tutors…";
  try {
    const response = await fetch(config.tutorsUrl);
    if (!response.ok) throw new Error("Could not load tutors.");
    catalog = validateCatalog(await response.json());
    refreshBookings();
    filters.replaceChildren();
    for (const value of ["All subjects", ...new Set(catalog.tutors.flatMap(t => t.subjects))]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-button";
      button.dataset.subject = value;
      button.textContent = value;
      button.setAttribute("aria-pressed", String(subject === value));
      filters.append(button);
    }
    document.querySelector("#time-zone").textContent = `Times: ${catalog.timeZone.replaceAll("_", " ")}`;
    renderTutors();
  } catch {
    count.textContent = "Tutors unavailable";
    document.querySelector("#load-error").hidden = false;
  }
}
document.querySelector("#retry").addEventListener("click", loadTutors);

if (config.notifications.recipientEmail) {
  const note = document.querySelector("#contact-note");
  note.textContent = "Need to change a session? ";
  const link = document.createElement("a");
  link.href = `mailto:${encodeURIComponent(config.notifications.recipientEmail)}`;
  link.textContent = "Email Dana directly.";
  note.append(link);
}

await loadTutors();

// Optional agent access uses the same visible selection flow; it never submits a booking.
if (document.modelContext?.registerTool) {
  try {
    await document.modelContext.registerTool({
      name: "list_tutoring_sessions",
      description: "List tutors and currently available practice sessions in this browser.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute() {
        refreshBookings();
        if (!catalog || !storageReady) throw new Error("Sessions are unavailable.");
        return { timeZone: catalog.timeZone, tutors: catalog.tutors.map(tutor => ({ ...tutor, availability: availableSlots(tutor, bookings) })) };
      },
    });
    await document.modelContext.registerTool({
      name: "start_tutoring_booking",
      description: "Select a tutor and session and open the visible booking form. Does not save a booking.",
      inputSchema: { type: "object", properties: { tutorId: { type: "string" }, slotId: { type: "string" } }, required: ["tutorId", "slotId"], additionalProperties: false },
      execute(input) {
        if (!input || typeof input.tutorId !== "string" || typeof input.slotId !== "string" || !chooseSlot(input.tutorId, input.slotId)) throw new Error("Choose an available tutor and slot.");
        return { status: "form_open", tutorId: input.tutorId, slotId: input.slotId };
      },
    });
  } catch { /* Unsupported experimental APIs do not affect the website. */ }
}
