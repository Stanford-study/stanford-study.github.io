import test from "node:test";
import assert from "node:assert/strict";
import { attribution, createAnalytics, sanitizeEvent } from "../js/analytics.js";

const settings = { enabled: true, projectToken: "phc_test", apiHost: "https://us.i.posthog.com" };
const context = attribution("https://example.test/tutoring/?utm_source=facebook&utm_medium=social&utm_campaign=parent_group&email=parent@example.test#private", "https://facebook.com/groups/private-group");

test("attribution retains campaign tags without query strings, fragments, or referrer paths", () => {
  assert.deepEqual(context, { $current_url: "https://example.test/tutoring/", $pathname: "/tutoring/", environment: "production", utm_source: "facebook", utm_medium: "social", utm_campaign: "parent_group", $referring_domain: "facebook.com" });
  assert.equal(attribution("https://example.test/?utm_source=parent@example.test").utm_source, undefined);
});

test("sanitizer excludes form contents and SDK initial URL properties", () => {
  const safe = sanitizeEvent({ event: "booking_completed", properties: { distinct_id: "anonymous", $session_id: "session", tutor_id: "maya", slot_id: "slot", storage_mode: "local", parentEmail: "private@example.test", studentGrade: 6, message: { body: "secret" }, $initial_current_url: "https://example.test/?email=secret", $current_url: "https://example.test/?email=secret", $set: { email: "secret" } } }, context);
  assert.equal(safe.properties.distinct_id, "anonymous");
  assert.equal(safe.properties.tutor_id, "maya");
  assert.equal(safe.properties.$current_url, "https://example.test/tutoring/");
  assert.doesNotMatch(JSON.stringify(safe), /secret|private@|studentGrade|parentEmail/);
  assert.equal(sanitizeEvent({ event: "$autocapture", properties: {} }, context), null);
});

test("SDK configuration disables capture of forms/replay and captures one pageview", () => {
  let options;
  const events = [];
  const win = { location: { href: "https://example.test/?utm_source=facebook" }, posthog: { init(token, opts) { assert.equal(token, settings.projectToken); options = opts; }, capture(name, props) { events.push(options.before_send({ event: name, properties: props })); } } };
  const analytics = createAnalytics(settings, win, { referrer: "" });
  analytics.init();
  analytics.init();
  analytics.track("booking_completed", { tutor_id: "maya", slot_id: "slot", parentEmail: "private@example.test", storage_mode: "local" });
  assert.equal(options.autocapture, false);
  assert.equal(options.disable_session_recording, true);
  assert.equal(options.person_profiles, "never");
  assert.equal(events.length, 2);
  assert.equal(events[0].event, "$pageview");
  assert.equal(events[1].properties.parentEmail, undefined);
});

test("disabled or failing telemetry never blocks callers", () => {
  const disabled = createAnalytics({ ...settings, enabled: false }, undefined, undefined);
  assert.doesNotThrow(() => { disabled.init(); disabled.track("booking_completed"); });
  const broken = createAnalytics(settings, { location: { href: "https://example.test" }, posthog: { init() { throw new Error("blocked"); }, capture() { throw new Error("blocked"); } } }, {});
  assert.doesNotThrow(() => { broken.init(); broken.track("booking_completed"); });
});

test("loader queues early events and uses the regional SDK URL", () => {
  let script;
  const win = { location: { href: "https://example.test/" } };
  const doc = { referrer: "", createElement: () => ({}), head: { append(value) { script = value; } } };
  const analytics = createAnalytics({ ...settings, apiHost: "https://eu.i.posthog.com" }, win, doc);
  analytics.init();
  analytics.track("subject_selected", { subject: "Math" });
  assert.equal(script.src, "https://eu-assets.i.posthog.com/static/array.js");
  assert.equal(win.posthog._i[0][0], settings.projectToken);
  assert.deepEqual(win.posthog.map(item => item[1]), ["$pageview", "subject_selected"]);
  script.onerror();
  analytics.track("subject_selected", { subject: "Science" });
  assert.equal(win.posthog.length, 0);
});
