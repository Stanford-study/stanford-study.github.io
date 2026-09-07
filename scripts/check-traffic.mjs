import { performance } from "node:perf_hooks";

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const base = new URL(option("--url", "http://127.0.0.1:8000/"));
const requests = Number(option("--requests", 45));
const concurrency = Number(option("--concurrency", 3));
if (!["127.0.0.1", "localhost", "stanford-study.github.io"].includes(base.hostname) || !["http:", "https:"].includes(base.protocol)) throw new Error("Use the local preview or this repository’s GitHub Pages URL.");
if (!Number.isInteger(requests) || requests < 1 || requests > 300 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 5) throw new Error("Choose 1–300 requests and 1–5 concurrent workers.");
const paths = ["./", "./styles.css", "./js/app.js", "./js/components.js", "./data/tutors.json"];
const results = [];
let next = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next < requests) {
    const path = paths[next++ % paths.length];
    const start = performance.now();
    let success = false;
    try {
      const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(10_000) });
      const body = await response.text();
      success = response.ok && body.length > 0;
      if (path.endsWith(".json")) success = success && Array.isArray(JSON.parse(body).tutors);
    } catch { /* Count transport, timeout, and malformed-data failures below. */ }
    results.push({ success, ms: performance.now() - start });
  }
}));
const times = results.map(result => result.ms).sort((a, b) => a - b);
const failed = results.filter(result => !result.success).length;
console.log(`${base.href}: ${requests - failed}/${requests} successful requests, concurrency ${concurrency}`);
console.log(`Average ${(times.reduce((sum, time) => sum + time, 0) / times.length).toFixed(1)} ms; p95 ${times[Math.ceil(times.length * 0.95) - 1].toFixed(1)} ms`);
console.log("This checks static asset responses, not browser rendering, shared booking capacity, or PostHog events.");
if (failed) process.exitCode = 1;
