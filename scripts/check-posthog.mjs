import { config } from "../js/config.js";

// Manual integration check: sends one clearly labeled, non-booking test event.
const { projectToken, apiHost, enabled } = config.posthog;
if (!enabled || !projectToken) throw new Error("Configure PostHog before running this check.");
const send = (path, body) => fetch(`${apiHost}${path}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(15_000),
});
const identity = `abc-tutoring-validation-${Date.now()}`;
const flags = await send("/flags/?v=2", { token: projectToken, distinct_id: identity });
if (!flags.ok) throw new Error(`PostHog project/host check failed: HTTP ${flags.status}`);
const response = await send("/capture/", {
  api_key: projectToken,
  event: "integration_check",
  properties: { distinct_id: identity, environment: "validation", $process_person_profile: false, purpose: "ABC Tutoring setup verification" },
  timestamp: new Date().toISOString(),
});
if (!response.ok) throw new Error(`PostHog capture failed: HTTP ${response.status}`);
console.log(`PostHog host accepted the project token and integration_check event (HTTP ${response.status}).`);
console.log("Look for integration_check in PostHog Activity to verify dashboard visibility.");
