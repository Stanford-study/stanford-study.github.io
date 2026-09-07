import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { config } from "../js/config.js";

// Sends 15 synthetic visitor journeys. No real bookings, emails, or personal data.
// Keep demo traffic separate from production reports with environment = demo.
const { projectToken, apiHost, enabled } = config.posthog;
if (!enabled || !projectToken) throw new Error("Configure PostHog before running this script.");
const catalog = JSON.parse(await readFile(new URL("../data/tutors.json", import.meta.url), "utf8"));
const run = `demo-${Date.now()}`;
const batch = [];
for (let index = 0; index < 15; index++) {
  const tutor = catalog.tutors[index % catalog.tutors.length];
  const slot = tutor.availability[0];
  if (!slot) throw new Error("Each demo tutor needs at least one sample slot.");
  const subject = tutor.subjects[index % tutor.subjects.length];
  const context = {
    distinct_id: `${run}-visitor-${index + 1}`,
    $session_id: randomUUID(),
    $process_person_profile: false,
    $current_url: "https://stanford-study.github.io/",
    $pathname: "/",
    environment: "demo",
    is_test: true,
    demo_run: run,
    utm_source: index % 2 ? "direct" : "facebook",
    utm_medium: index % 2 ? "none" : "social",
    utm_campaign: index % 2 ? "demo_direct" : "parent_group",
  };
  let step = 0;
  const capture = (event, properties = {}) => batch.push({
    event,
    properties: { ...context, ...properties },
    timestamp: new Date(Date.now() - (15 - index) * 60_000 + step++ * 2000).toISOString(),
  });
  capture("$pageview");
  capture("subject_selected", { subject });
  capture("tutor_viewed", { tutor_id: tutor.id });
  if (index % 3 !== 1) {
    capture("booking_started", { tutor_id: tutor.id, subject });
    capture("slot_selected", { tutor_id: tutor.id, slot_id: slot.id });
    if (index % 3 === 0) capture("booking_completed", { tutor_id: tutor.id, slot_id: slot.id, storage_mode: "local" });
  }
}
const response = await fetch(`${apiHost.replace(/\/$/, "")}/batch/`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ api_key: projectToken, batch }),
  signal: AbortSignal.timeout(15_000),
});
if (!response.ok) throw new Error(`PostHog rejected the demo batch: HTTP ${response.status}`);
console.log(`PostHog accepted ${batch.length} demo events: 15 visitors → 10 booking starts → 5 completions.`);
console.log(`Filter PostHog by environment = demo and demo_run = ${run}.`);
console.log("This is synthetic dashboard data, not a browser or production-capacity test.");
