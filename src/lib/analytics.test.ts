// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { Analytics } from "@/lib/analytics";

describe("Analytics.track", () => {
  afterEach(() => {
    window.umami = undefined;
  });

  it("does nothing when the tracker is absent", () => {
    expect(() => Analytics.track("Export", { format: "npn" })).not.toThrow();
  });

  it("sends the name and data to the tracker", () => {
    const track = vi.fn();
    window.umami = { track };
    Analytics.track("Export", { format: "npn" });
    expect(track).toHaveBeenCalledWith("Export", { format: "npn" });
  });

  it("swallows an error from the tracker", () => {
    window.umami = {
      track: () => {
        throw new Error("tracker failed");
      },
    };
    expect(() => Analytics.track("Enter simulation")).not.toThrow();
  });
});

describe("Analytics.trackOnce", () => {
  it("sends an event only the first time in a page load", () => {
    const track = vi.spyOn(Analytics, "track").mockImplementation(() => {});
    Analytics.trackOnce("Once test");
    Analytics.trackOnce("Once test");
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("Once test");
    track.mockRestore();
  });
});
