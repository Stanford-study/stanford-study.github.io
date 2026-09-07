# ABC Tutoring — first version

## Interface

- Start with a simple ABC Tutoring header and tutor list; no introduction.
- Use visible subject filter buttons, tutor information, and short availability lists.
- No dropdowns, accordions, or expandable tutor menus. Use radio buttons for slot and grade selection.
- Selecting a slot opens an inline booking form with the tutor/time summary, parent email, and student grade.
- Save bookings locally and show a confirmation. No cancellation management.
- Use an off-white background, teal actions, peach accents, readable system fonts, and responsive cards.

## Tutor data

`data/tutors.json` contains fictional sample tutors and dated sample slots.
Replace them with Dana's actual information. Grades are numeric school grades.
Slot timestamps include UTC offsets; the top-level IANA time zone provides display context.
Keep tutor and slot IDs stable, since local bookings reference them.
Availability is an initial inventory, not a record of live reservations.
The interface will exclude past slots and slots booked in this browser; update dated slots as needed.
Load this file with a relative URL so it works under a GitHub Pages repository path.

## Email notifications

`js/config.js` exposes the recipient email, sender email, and notification mode.
`js/notifications.js` implements an asynchronous stub that explicitly returns
`delivered: false`. Nothing is emailed. After saving a booking, it logs a clearly
labeled developer preview with recipient, sender, subject, and full message content.
The preview stays out of PostHog. Call it after saving a booking;
a future delivery failure must not undo a saved booking or invite duplicate submission.
Changing the recipient alone does not enable delivery. Real sending needs an
external delivery service/endpoint and an updated adapter; private provider credentials
must never be embedded in this public repository or browser code.

## PostHog integration plan

SDK initialization and event wiring are implemented. Dashboard setup is documented in README.md;
dashboards require access to the PostHog project and are not created by the public token.
Use the official browser SDK with the public project token and matching regional host.
Keep explicit analytics separate from booking logic, so unavailable analytics never blocks booking.
Disable broad autocapture and session replay initially. Do not send parent email,
student grade, form contents, or booking records to PostHog.

| Event | Trigger | Allowed custom properties |
| --- | --- | --- |
| `$pageview` | Initial page visit | Sanitized source/medium/campaign and referrer host |
| `subject_selected` | Select a subject filter | `subject` |
| `tutor_viewed` | Tutor card is at least 50% visible for one second; once per tutor per page load | `tutor_id` |
| `booking_started` | First entry into booking for a tutor | `tutor_id`, `subject` if selected |
| `slot_selected` | Select a time slot | `tutor_id`, `slot_id` |
| `booking_completed` | Booking successfully saved locally; once per saved booking | `tutor_id`, `slot_id`, `storage_mode: local` |

Since profiles are always visible, `tutor_viewed` measures exposure, not an intentional
profile opening. Compare it with booking starts to understand engagement.
Build a pageview → booking_started → booking_completed funnel and subject/tutor reports.
Use a Facebook group link tagged with `utm_source=facebook`, `utm_medium=social`,
and `utm_campaign=parent_group`; referrer alone cannot reliably identify a specific group.
Infer abandonment from funnel drop-off, not an unreliable browser-close event.
Verify actual events arrive in PostHog before calling the integration complete.
Local completion measures this prototype's saved bookings, not shared reservations or email delivery.

## Scope and validation

Plain HTML, CSS, ES modules, native custom elements, localStorage, and GitHub Pages.
No framework or compilation required. The page, JSON loading, local booking flow,
PostHog adapter, email console preview, tests, and GitHub Pages workflow are implemented.
When implementing the page, check keyboard navigation, mobile layout, local persistence,
duplicate-submit protection, slot exclusion, and PostHog event delivery.
