import { describe, expect, it } from "vitest";
import { slotFor, slotMismatch, slotYears } from "@/lib/sessionSlots";

const DAY = ["14.00 - 15.30 Players Born - 2020/2021", "16.00 - 17.30 Players Born - 2019"];

describe("session slots", () => {
  it("reads the birth years after 'Born', not the times", () => {
    expect(slotYears(DAY[0])).toEqual([2020, 2021]);
    expect(slotYears(DAY[1])).toEqual([2019]);
    expect(slotYears("Morning session")).toEqual([]);
  });
  it("flags a child in the wrong age session", () => {
    expect(slotMismatch(DAY[0], 2019)).toBe(true);   // Anya, born Dec 2019
    expect(slotMismatch(DAY[0], 2021)).toBe(false);
    expect(slotMismatch(DAY[1], 2019)).toBe(false);
    expect(slotMismatch("Morning session", 2019)).toBe(false);
    expect(slotMismatch(DAY[0], null)).toBe(false);
  });
  it("picks the one session that fits", () => {
    expect(slotFor(DAY, 2019)).toBe(DAY[1]);
    expect(slotFor(DAY, 2020)).toBe(DAY[0]);
    expect(slotFor(DAY, 2018)).toBeNull();
    expect(slotFor(DAY, null)).toBeNull();
  });
});
