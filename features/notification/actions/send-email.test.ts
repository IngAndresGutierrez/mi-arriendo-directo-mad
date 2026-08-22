import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendEmail } from "./send-email";

const email = {
  to: "alguien@example.com",
  subject: "Nueva postulación",
  text: "…",
  html: "<p>…</p>",
};

/** The body Resend was asked to send, parsed. */
function sentBody(call: number = 0): Record<string, unknown> {
  const [, init] = vi.mocked(globalThis.fetch).mock.calls[call] as [string, RequestInit];

  return JSON.parse(String(init.body));
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("RESEND_EMAIL_DOMAIN", "miarriendodirecto.com");
  vi.stubEnv("EMAIL_FROM", "");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("sendEmail", () => {
  it("posts the message and reports success", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response("{}", { status: 200 }));

    expect(await sendEmail(email)).toBe(true);
    expect(sentBody()).toMatchObject({
      to: ["alguien@example.com"],
      subject: "Nueva postulación",
      html: "<p>…</p>",
      text: "…",
    });
  });

  /*
   * Resend answers 403 when the `from` domain is not exactly one it verified, and that is the
   * failure that slips through most easily. Deriving it from the variable the integration sets
   * is what keeps the two from drifting apart.
   */
  it("sends from the verified domain, not a hardcoded one", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubEnv("RESEND_EMAIL_DOMAIN", "otro-dominio.com");

    await sendEmail(email);

    expect(sentBody().from).toBe("miarriendoDIRECTO <no-responder@otro-dominio.com>");
  });

  it("lets EMAIL_FROM override the whole header", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubEnv("EMAIL_FROM", "MAD <hola@ejemplo.com>");

    await sendEmail(email);

    expect(sentBody().from).toBe("MAD <hola@ejemplo.com>");
  });

  // Locally there is no key and there is no reason for there to be one.
  it("does not send, and does not fail, without a key", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    expect(await sendEmail(email)).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  /*
   * Only the 429 is retried, and the distinction is the whole design: it is the one response
   * that refused the request without sending anything, so repeating it cannot duplicate an
   * email. A 500 is ambiguous — it may well have gone out — and retrying there is how somebody
   * gets told the same news twice.
   */
  it("retries a rate limit and then succeeds", async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    expect(await sendEmail(email)).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a 500: the email may already have gone out", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response("boom", { status: 500 }));

    expect(await sendEmail(email)).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry a 403 either: an unverified domain will not fix itself", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response("not verified", { status: 403 }));

    expect(await sendEmail(email)).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  // It runs after the write that mattered is already saved: an exception here would look like
  // the action itself had failed.
  it("never throws, whatever the network does", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error("network down"));

    await expect(sendEmail(email)).resolves.toBe(false);
  });

  it("gives up after repeated rate limits instead of looping", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response("", { status: 429 }));

    expect(await sendEmail(email)).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
  }, 20_000);
});
