// Public browser configuration. Never put private email-provider keys here.
export const config = {
  tutorsUrl: "./data/tutors.json",
  notifications: {
    mode: "stub",
    recipientEmail: "", // Set Dana's address when available; stub sends nothing.
    senderEmail: "", // Future verified sender address for the delivery service.
  },
  posthog: {
    enabled: true,
    projectToken: "phc_CwmEaddvZ5XXUErq58qGDvsB73WNAZaCFr2vYqDB3MFH",
    apiHost: "https://us.i.posthog.com",
    autocapture: false,
    disable_session_recording: true,
  },
};
