import { escapeHTML as html, formatSlot, gradeLabel } from "./data.js";

export class TutorCard extends HTMLElement {
  set details(value) { this.model = value; this.render(); }
  connectedCallback() {
    this.addEventListener("change", event => {
      if (event.target.name !== "session-slot") return;
      this.dispatchEvent(new CustomEvent("slot-chosen", { bubbles: true, detail: { tutorId: this.model.tutor.id, slotId: event.target.value } }));
    });
  }
  render() {
    const { tutor, slots, timeZone, selectedSlot, index } = this.model;
    const initials = tutor.name.split(/\s+/).map(part => part[0]).slice(0, 2).join("");
    this.innerHTML = `<article class="tutor-card ${slots.some(slot => slot.id === selectedSlot) ? "is-selected" : ""}" data-tone="${index % 3}" aria-labelledby="name-${html(tutor.id)}">
      <div class="tutor-heading"><span class="avatar" aria-hidden="true">${html(initials)}</span><div><h2 id="name-${html(tutor.id)}">${html(tutor.name)}</h2><p class="grade-note">Grades ${tutor.grades.map(gradeLabel).map(html).join(", ")}</p></div></div>
      <div class="subjects">${tutor.subjects.map(subject => `<span class="subject-tag">${html(subject)}</span>`).join("")}</div>
      <fieldset class="slots"><legend>Available sessions <span class="sr-only">with ${html(tutor.name)}</span></legend>
      <div class="slot-list">${slots.map(slot => {
        const label = formatSlot(slot, timeZone);
        return `<label class="slot-option"><input type="radio" name="session-slot" value="${html(slot.id)}" ${slot.id === selectedSlot ? "checked" : ""} aria-label="${html(`${tutor.name}, ${label.date}, ${label.time} ${label.zone}`)}"><span><span class="slot-date">${html(label.date)}</span><span class="slot-time">${html(label.time)}</span></span></label>`;
      }).join("")}</div>${slots.length ? "" : '<p class="empty-slots">No available sessions right now.</p>'}</fieldset>
    </article>`;
  }
}

export class BookingForm extends HTMLElement {
  connectedCallback() {
    this.renderPlaceholder();
    this.addEventListener("submit", event => {
      event.preventDefault();
      if (this.busy || !this.selection) return;
      const form = event.target;
      if (!form.reportValidity()) return;
      const values = new FormData(form);
      this.dispatchEvent(new CustomEvent("booking-requested", { bubbles: true, detail: {
        tutorId: this.selection.tutor.id,
        slotId: this.selection.slot.id,
        parentEmail: values.get("parent-email"),
        studentGrade: Number(values.get("student-grade")),
      } }));
    });
    this.addEventListener("click", event => {
      if (event.target.closest("[data-book-another]")) {
        this.renderPlaceholder();
        this.dispatchEvent(new CustomEvent("book-another", { bubbles: true }));
      }
    });
  }
  renderPlaceholder() {
    this.selection = null;
    this.innerHTML = `<p class="panel-kicker">Your session</p><h2>Let’s find a time.</h2><div class="booking-placeholder"><p>Choose an available session with a tutor to get started.</p><ol class="booking-steps"><li><span class="step-number">1</span>Choose your tutor &amp; time</li><li><span class="step-number">2</span>Add your student’s details</li><li><span class="step-number">3</span>Book your session</li></ol></div>`;
  }
  select(tutor, slot, timeZone) {
    const email = this.querySelector('[name="parent-email"]')?.value ?? "";
    const grade = this.querySelector('[name="student-grade"]:checked')?.value;
    this.selection = { tutor, slot, timeZone };
    this.busy = false;
    const label = formatSlot(slot, timeZone);
    this.innerHTML = `<p class="panel-kicker">02 &nbsp; Your details</p><h2 tabindex="-1">Book your session</h2>
      <div class="booking-summary"><strong>${html(tutor.name)}</strong><p>${html(label.date)}</p><p>${html(label.time)} ${html(label.zone)}</p></div>
      <form class="ph-no-capture"><label for="parent-email" class="field-label">Parent’s email</label><input class="email-input" id="parent-email" name="parent-email" type="email" autocomplete="email" maxlength="254" required value="${html(email)}" placeholder="you@example.com">
      <fieldset class="grade-options"><legend>Student’s grade</legend><div class="grade-grid">${tutor.grades.map(g => `<label class="grade-option"><input type="radio" name="student-grade" value="${g}" required ${String(g) === grade ? "checked" : ""}>${html(gradeLabel(g))}</label>`).join("")}</div></fieldset>
      <p class="notice error form-error" role="alert" hidden></p><button type="submit" class="button full">Book session <span aria-hidden="true">→</span></button>
      <p class="form-note">This practice booking is saved in this browser. No email will be sent.</p></form>`;
  }
  setBusy(value) {
    this.busy = value;
    const button = this.querySelector('button[type="submit"]');
    if (button) { button.disabled = value; button.textContent = value ? "Saving your session…" : "Book session →"; }
    this.querySelector("form")?.setAttribute("aria-busy", String(value));
  }
  showError(message) {
    const box = this.querySelector(".form-error");
    if (box) { box.textContent = message; box.hidden = false; }
    this.setBusy(false);
  }
  confirm(booking, tutor, slot, timeZone) {
    this.selection = null;
    this.busy = false;
    const label = formatSlot(slot, timeZone);
    this.innerHTML = `<span class="success-mark" aria-hidden="true">✓</span><p class="panel-kicker">Session saved</p><h2 tabindex="-1">You’re all set.</h2><div class="booking-summary"><strong>${html(tutor.name)}</strong><p>${html(label.date)}</p><p>${html(label.time)} ${html(label.zone)}</p><p>Grade ${html(gradeLabel(booking.studentGrade))}</p></div><p class="confirmation-copy">Your practice booking is saved in this browser. No email has been sent.</p><p class="confirmation-copy">Need to change a session? Contact Dana directly.</p><p class="confirmation-ref">Reference: ${html(booking.id.slice(0, 8).toUpperCase())}</p><button type="button" class="button secondary full" data-book-another>Book another session</button>`;
    this.querySelector("h2").focus();
  }
}

customElements.define("tutor-card", TutorCard);
customElements.define("booking-form", BookingForm);
