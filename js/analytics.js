import { config } from "./config.js";

const eventFields = {
  $pageview: [],
  subject_selected: ["subject"],
  tutor_viewed: ["tutor_id"],
  booking_started: ["tutor_id", "subject"],
  slot_selected: ["tutor_id", "slot_id"],
  booking_completed: ["tutor_id", "slot_id", "storage_mode"],
};
const sdkFields = new Set(["token", "distinct_id", "$device_id", "$session_id", "$window_id", "$lib", "$lib_version", "$browser", "$browser_version", "$os", "$os_version", "$device_type", "$screen_height", "$screen_width", "$viewport_height", "$viewport_width", "$is_identified", "$process_person_profile"]);

export function attribution(href, referrer = "") {
  const url = new URL(href), props = {
    $current_url: `${url.origin}${url.pathname}`,
    $pathname: url.pathname,
    environment: ["localhost", "127.0.0.1"].includes(url.hostname) ? "development" : "production",
  };
  for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
    const value = url.searchParams.get(key);
    if (value && /^[a-zA-Z0-9_-]{1,64}$/.test(value)) props[key] = value;
  }
  try { props.$referring_domain = new URL(referrer).hostname; } catch { props.$referring_domain = "$direct"; }
  return props;
}

export function sanitizeEvent(event, context) {
  if (!event || !Object.hasOwn(eventFields, event.event)) return null;
  const allowed = new Set([...sdkFields, ...eventFields[event.event]]);
  const properties = {};
  for (const [key, value] of Object.entries(event.properties ?? {})) {
    if (allowed.has(key) && ["string", "number", "boolean"].includes(typeof value)) properties[key] = value;
  }
  return { ...event, properties: { ...properties, ...context } };
}

// Official PostHog HTML-snippet queue pattern, loaded only when configured.
function loadPostHog(settings, options, win, doc) {
  if (win.posthog?.init && !Array.isArray(win.posthog)) {
    win.posthog.init(settings.projectToken, options);
    return win.posthog;
  }
  const client = [];
  client._i = [[settings.projectToken, options]];
  client.__SV = 1;
  client.people = [];
  for (const name of ["capture", "register", "register_once", "unregister", "identify", "reset", "set_config", "opt_in_capturing", "opt_out_capturing"]) {
    client[name] = (...args) => { if (client.length < 100) client.push([name, ...args]); };
  }
  win.posthog = client;
  const script = doc.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `${settings.apiHost.replace(/\.i\.posthog\.com\/?$/, "-assets.i.posthog.com").replace(/\/$/, "")}/static/array.js`;
  script.onerror = () => { client.length = 0; client.capture = () => {}; };
  doc.head.append(script);
  return client;
}

export function createAnalytics(settings, win, doc) {
  let initialized = false;
  let context = {};
  return {
    init() {
      if (initialized || !settings.enabled || !settings.projectToken?.trim()) return;
      initialized = true;
      try {
        if (new URL(settings.apiHost).protocol !== "https:") return;
        context = attribution(win.location.href, doc.referrer);
        loadPostHog(settings, {
          api_host: settings.apiHost,
          defaults: "2026-05-30",
          autocapture: false,
          capture_pageview: false,
          capture_pageleave: false,
          capture_dead_clicks: false,
          capture_exceptions: false,
          capture_heatmaps: false,
          capture_performance: false,
          disable_session_recording: true,
          disable_surveys: true,
          advanced_disable_flags: true,
          person_profiles: "never",
          persistence: "localStorage",
          save_referrer: false,
          store_google: false,
          before_send: event => sanitizeEvent(event, context),
        }, win, doc);
        this.track("$pageview");
      } catch { /* Telemetry must never prevent using the site. */ }
    },
    track(name, properties = {}) {
      if (!initialized || !settings.enabled || !settings.projectToken || !Object.hasOwn(eventFields, name)) return;
      try {
        const safe = Object.fromEntries(eventFields[name].filter(key => typeof properties[key] === "string").map(key => [key, properties[key]]));
        win.posthog?.capture(name, { ...safe, ...context });
      } catch { /* Blocking analytics is safe. */ }
    },
  };
}

export const analytics = createAnalytics(config.posthog, globalThis.window, globalThis.document);
