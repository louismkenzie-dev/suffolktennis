import { describe, it, expect } from "vitest";
import { calendarLinks, formatTime, formatTimeRange } from "../lib/timeFormat";

describe("formatTime", () => {
  it("renders 12-hour British style", () => {
    expect(formatTime("13:30:00")).toBe("1.30pm");
    expect(formatTime("09:00")).toBe("9am");
    expect(formatTime("00:15")).toBe("12.15am");
    expect(formatTime("12:00")).toBe("12pm");
  });
  it("is empty for nothing", () => {
    expect(formatTime(null)).toBe("");
    expect(formatTime(undefined)).toBe("");
  });
});

describe("formatTimeRange", () => {
  it("collapses a shared meridiem", () => {
    expect(formatTimeRange("13:30", "15:30")).toBe("1.30–3.30pm");
    expect(formatTimeRange("09:00", "11:00")).toBe("9–11am");
  });
  it("keeps both when they differ", () => {
    expect(formatTimeRange("11:30", "13:30")).toBe("11.30am–1.30pm");
  });
  it("falls back to the start alone", () => {
    expect(formatTimeRange("13:30", null)).toBe("1.30pm");
  });
});

describe("calendarLinks", () => {
  it("builds Google and Outlook links with an encoded title and a two-hour default", () => {
    const { google, outlook } = calendarLinks({
      title: "9U County Training", date: "2026-09-27", start: "13:30", location: "Culford",
    });
    expect(google).toContain("text=9U%20County%20Training");
    expect(google).toContain("location=Culford");
    expect(google).toMatch(/dates=\d{8}T\d{6}Z\/\d{8}T\d{6}Z/);
    expect(outlook).toContain("subject=9U%20County%20Training");
    expect(outlook).toContain("startdt=");
  });
});
