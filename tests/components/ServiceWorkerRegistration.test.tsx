import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";

describe("ServiceWorkerRegistration", () => {
  it("registers the service worker after the page loads", async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    render(<ServiceWorkerRegistration />);
    window.dispatchEvent(new Event("load"));

    await waitFor(() => expect(register).toHaveBeenCalledWith("/sw.js"));
  });
});
