import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { availableSlots, validateCatalog, formatSlot } from "../js/data.js";
import { readBookings, saveBooking, STORAGE_KEY } from "../js/bookings.js";
import { sendBookingNotification } from "../js/notifications.js";
import { config } from "../js/config.js";

const catalog = validateCatalog(JSON.parse(await readFile(new URL("../data/tutors.json", import.meta.url))));
const tutor = catalog.tutors[0], slot = tutor.availability[0];
const now = () => Date.parse("2026-09-07T12:00:00Z");
const input = { tutorId: tutor.id, slotId: slot.id, parentEmail: "parent@example.test", studentGrade: tutor.grades[0] };
function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test("booking persists and removes exactly its slot from availability", async () => {
  const store = storage();
  const booking = await saveBooking(catalog, input, { storage: store, now, makeId: () => "test-booking" });
  assert.equal(booking.parentEmail, input.parentEmail);
  assert.deepEqual(readBookings(store), [booking]);
  assert.equal(availableSlots(tutor, readBookings(store), now()).length, tutor.availability.length - 1);
  await assert.rejects(saveBooking(catalog, input, { storage: store, now }), /just booked/);
  assert.equal(readBookings(store).length, 1);
});

test("rejects invalid input, expired slots, and mismatched tutor/slot without writing", async () => {
  const store = storage();
  for (const invalid of [{ parentEmail: "invalid" }, { studentGrade: 12 }, { tutorId: "missing" }, { slotId: "missing" }]) {
    await assert.rejects(saveBooking(catalog, { ...input, ...invalid }, { storage: store, now }));
  }
  await assert.rejects(saveBooking(catalog, input, { storage: store, now: () => Date.parse(slot.start) }), /no longer available/);
  assert.deepEqual(readBookings(store), []);
});

test("storage failures do not report success or overwrite corrupted records", async () => {
  const store = storage();
  store.setItem(STORAGE_KEY, "not JSON");
  assert.throws(() => readBookings(store), /couldn’t be read/);
  await assert.rejects(saveBooking(catalog, input, { storage: store, now }), /couldn’t be read/);
  assert.equal(store.getItem(STORAGE_KEY), "not JSON");
  await assert.rejects(saveBooking(catalog, input, { now, storage: { getItem: () => null, setItem: () => { throw new Error("quota"); } } }), /couldn’t be saved/);
});

test("concurrent bookings through a shared lock only reserve a slot once", async () => {
  const store = storage();
  let pending = Promise.resolve();
  const locks = { request(name, callback) { assert.equal(name, STORAGE_KEY); const next = pending.then(callback); pending = next.catch(() => {}); return next; } };
  const results = await Promise.allSettled([saveBooking(catalog, input, { storage: store, locks, now }), saveBooking(catalog, input, { storage: store, locks, now })]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(readBookings(store).length, 1);
});

test("catalog rejects duplicate slots and invalid dates; display uses catalog time zone", () => {
  const invalid = structuredClone(catalog);
  invalid.tutors[1].availability.push(invalid.tutors[0].availability[0]);
  assert.throws(() => validateCatalog(invalid), /Invalid availability/);
  const dates = structuredClone(catalog);
  dates.tutors[0].availability[0].end = "not a date";
  assert.throws(() => validateCatalog(dates), /Invalid availability/);
  assert.equal(formatSlot(slot, catalog.timeZone).time, "4:00 PM – 5:00 PM");
  assert.equal(availableSlots(tutor, [], Date.parse("2030-01-01T00:00:00Z")).length, 0);
});

test("email stub logs configurable sender, recipient, subject and complete content without delivery", async t => {
  const logs = [];
  t.mock.method(console, "info", (...args) => logs.push(args));
  const original = { ...config.notifications };
  config.notifications.recipientEmail = "dana@example.test";
  config.notifications.senderEmail = "bookings@example.test";
  try {
    const result = await sendBookingNotification({ ...input, id: "test-booking" }, { tutor, slot, timeZone: catalog.timeZone });
    assert.equal(result.delivered, false);
    assert.equal(result.message.to, "dana@example.test");
    assert.equal(result.message.from, "bookings@example.test");
    assert.match(result.message.subject, /Maya Chen/);
    assert.match(result.message.body, /Parent email: parent@example.test/);
    assert.match(result.message.body, /Student grade: 6/);
    assert.match(result.message.body, /4:00 PM/);
    assert.equal(logs.length, 1);
    assert.equal(logs[0][0], "[EMAIL STUB — not sent]");
    assert.deepEqual(logs[0][1], result.message);
    config.notifications.mode = "live";
    await assert.rejects(sendBookingNotification({ id: "test" }), /Only stub/);
    assert.equal(logs.length, 1);
  } finally { Object.assign(config.notifications, original); }
});
