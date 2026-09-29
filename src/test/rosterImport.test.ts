import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import * as XLSX from "xlsx";
import {
  analyseRows, classifyRows, excelSerialToIso, fieldForHeader, findHeader, mapColumns,
  normaliseAgeGroup, normaliseGender, parseDelimited, parseDob, readSpreadsheet, splitName,
  ageGroupFromYears, type ExistingPlayer,
} from "../lib/rosterImport";

// Age groups depend on the current year.
beforeAll(() => { vi.useFakeTimers({ now: new Date("2026-09-28T12:00:00Z"), toFake: ["Date"] }); });
afterAll(() => { vi.useRealTimers(); });

const existing: ExistingPlayer[] = [
  { id: "1", lta_number: "110466295", first_name: "Josh", last_name: "Abbott", age_group: "18U", contact_email: "steveabbott999@googlemail.com" },
  { id: "2", lta_number: null, first_name: "Lilly", last_name: "Noreika", age_group: "10U", contact_email: "lioncics@gmail.com" },
  { id: "3", lta_number: "119940363", first_name: "Louise", last_name: "Agran", age_group: "Open", contact_email: "louiseagran@gmail.com" },
  { id: "4", lta_number: null, first_name: "Sam", last_name: "Smith", age_group: "9U", contact_email: "smith.family@example.com" },
];

describe("parseDelimited", () => {
  it("handles quotes, doubled quotes, CRLF and a BOM", () => {
    const rows = parseDelimited('﻿Name,Email\r\n"Abbott, Josh","a@b.com"\r\n"Say ""hi""",c@d.com\r\n');
    expect(rows).toEqual([["Name", "Email"], ["Abbott, Josh", "a@b.com"], ['Say "hi"', "c@d.com"]]);
  });
  it("detects semicolons and tabs", () => {
    expect(parseDelimited("a;b;c\n1;2;3")).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
    expect(parseDelimited("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("keeps blank lines so row numbers match the file", () => {
    expect(parseDelimited("a,b\n\n,\n1,2")).toEqual([["a", "b"], [""], ["", ""], ["1", "2"]]);
    const sheet = analyseRows([["Name"], [""], ["Ava Brown"], [], ["Ava Brown"]], []);
    expect(sheet.rowsRead).toBe(2);
    expect(sheet.rows.map((r) => r.kind)).toEqual(["new", "duplicate"]);
    expect(sheet.rows[1]).toMatchObject({ line: 5, ofLine: 3 });
  });
});

describe("column recognition", () => {
  it("knows the LTA report's columns", () => {
    const { columns, ignored } = mapColumns(["LTA Number", "First Name", "Last Name", "Gender", "Mobile", "Email", "LTA Marketing Opt-In", "Age Group", "Singles WTN", "Doubles WTN", "RCP Match Count", "RCP Type"]);
    expect(columns).toEqual({ lta: 0, first: 1, last: 2, gender: 3, mobile: 4, email: 5, optin: 6, age: 7, swtn: 8, dwtn: 9, matches: 10, rcptype: 11 });
    expect(ignored).toEqual([]);
  });
  it("copes with a club's own headings", () => {
    expect(fieldForHeader("Player's Name")).toBe("full");
    expect(fieldForHeader("Parent / Guardian Email Address")).toBe("email");
    expect(fieldForHeader("Parent/Guardian")).toBe("contact");
    expect(fieldForHeader("D.O.B.")).toBe("dob");
    expect(fieldForHeader("Boy/Girl")).toBe("gender");
    expect(fieldForHeader("Mobile No:")).toBe("mobile");
    expect(fieldForHeader("British Tennis Number")).toBe("lta");
    expect(fieldForHeader("Surname")).toBe("last");
    expect(fieldForHeader("Forename")).toBe("first");
    expect(fieldForHeader("Ball colour")).toBe("age");
    expect(fieldForHeader("Club")).toBeNull();
    expect(fieldForHeader("Coach")).toBeNull();
  });
  it("lists columns it ignored", () => {
    const { columns, ignored } = mapColumns(["Name", "Club", "Coach", "Email"]);
    expect(columns).toEqual({ full: 0, email: 3 });
    expect(ignored).toEqual(["Club", "Coach"]);
  });
  it("finds the header under the LTA report's preamble", () => {
    const rows = [["Suffolk RCP report"], ["Exported", "28/09/2026"], [], ["LTA Number", "First Name", "Last Name", "Email"], ["1", "A", "B", "x@y.com"]];
    expect(findHeader(rows)).toBe(3);
  });
  it("gives up without a name column", () => {
    expect(findHeader([["Email", "Mobile"], ["a@b.com", "07000"]])).toBe(-1);
    expect(() => analyseRows([["Email"], ["a@b.com"]], [])).toThrow(/name/);
  });
});

describe("cell normalising", () => {
  it("genders", () => {
    expect(normaliseGender("M")).toBe("Male");
    expect(normaliseGender("girl")).toBe("Female");
    expect(normaliseGender("Female")).toBe("Female");
    expect(normaliseGender("")).toBeNull();
  });
  it("age groups in every spelling", () => {
    expect(normaliseAgeGroup("10U")).toBe("10U");
    expect(normaliseAgeGroup("U9")).toBe("9U");
    expect(normaliseAgeGroup("10 & Under")).toBe("10U");
    expect(normaliseAgeGroup("Under 12s")).toBe("12U");
    expect(normaliseAgeGroup("13U")).toBe("14U");
    expect(normaliseAgeGroup("Open")).toBe("Open");
    expect(normaliseAgeGroup("Adult")).toBe("Open");
    expect(normaliseAgeGroup("Red")).toBe("8U");
    expect(normaliseAgeGroup("Green ball")).toBe("10U");
    expect(normaliseAgeGroup("")).toBeNull();
  });
  it("ages and dates of birth", () => {
    expect(ageGroupFromYears("9")).toBe("9U");
    expect(ageGroupFromYears("13")).toBe("14U");
    expect(ageGroupFromYears("adult")).toBeNull();
    expect(parseDob("14/09/2017")).toBe("2017-09-14");
    expect(parseDob("2017-09-14")).toBe("2017-09-14");
    expect(parseDob("3.1.19")).toBe("2019-01-03");
    expect(parseDob("not a date")).toBeNull();
    expect(excelSerialToIso(25569)).toBe("1970-01-01");
    expect(excelSerialToIso(43000)).toBe("2017-09-22");
  });
  it("names", () => {
    expect(splitName("Josh Abbott")).toEqual({ first: "Josh", last: "Abbott" });
    expect(splitName("Abbott, Josh")).toEqual({ first: "Josh", last: "Abbott" });
    expect(splitName("Mary Jane Watson")).toEqual({ first: "Mary Jane", last: "Watson" });
    expect(splitName("Cher")).toEqual({ first: "Cher", last: "" });
  });
});

describe("classifyRows", () => {
  const header = ["Name", "LTA Number", "Parent Email", "Age Group", "DOB", "Gender", "Squad"];
  const run = (rows: string[][]) => analyseRows([header, ...rows], existing);

  it("adds someone the database has never seen", () => {
    const r = run([["Ava Brown", "", "brown@example.com", "9U", "", "F", "10U county squad"]]);
    expect(r.counts).toEqual({ new: 1, existing: 0, review: 0, duplicate: 0, skipped: 0 });
    const row = r.rows[0];
    expect(row.kind).toBe("new");
    if (row.kind !== "new") return;
    expect(row.row).toMatchObject({ first_name: "Ava", last_name: "Brown", gender: "Female", age_group: "9U", contact_email: "brown@example.com", tags: ["10U county squad"], lta_number: null });
    expect(row.line).toBe(2);
  });

  it("matches on LTA number even when the name is spelt differently", () => {
    const r = run([["Joshua Abbot", "110466295", "", "", "", "", ""]]);
    expect(r.rows[0]).toMatchObject({ kind: "existing", how: "same LTA number", match: { id: "1" } });
  });

  it("matches on name, ignoring case and accents", () => {
    const r = run([["LILLY NOREIKA", "", "lioncics@gmail.com", "", "", "", ""], ["Louise Ágran", "", "", "Open", "", "", ""]]);
    expect(r.rows[0]).toMatchObject({ kind: "existing", how: "same name and parent email" });
    expect(r.rows[1]).toMatchObject({ kind: "existing", how: "same name and age group" });
  });

  it("puts a same-name row with a different parent email aside to check", () => {
    const r = run([["Sam Smith", "", "other.parent@example.com", "9U", "", "", ""]]);
    expect(r.rows[0]).toMatchObject({ kind: "review", match: { id: "4" } });
    expect((r.rows[0] as { how: string }).how).toContain("smith.family@example.com");
  });

  it("works out the age group from a date of birth when there is no group", () => {
    const r = run([["Tom Green", "", "", "", "22/09/2017", "", ""]]);
    expect(r.rows[0]).toMatchObject({ kind: "new", row: { age_group: "9U" } });
  });

  it("flags the same child listed twice and rows with no name", () => {
    const r = run([["Ava Brown", "", "", "", "", "", ""], ["ava brown", "", "", "", "", "", ""], ["", "123", "x@y.com", "", "", "", ""]]);
    expect(r.rows.map((x) => x.kind)).toEqual(["new", "duplicate", "skipped"]);
    expect(r.rows[1]).toMatchObject({ ofLine: 2 });
    expect(r.rows[2]).toMatchObject({ reason: "No name" });
  });

  it("never produces an update or delete — only rows to add", () => {
    const rows = classifyRows([header, ["Josh Abbott", "110466295", "new@example.com", "16U", "", "", ""]], 0, mapColumns(header).columns, existing);
    expect(rows[0].kind).toBe("existing"); // the differing email/age are not applied anywhere
  });
});

describe("readSpreadsheet", () => {
  const fileOf = (name: string, data: ArrayBuffer | string, type = "") => ({
    name, type,
    arrayBuffer: async () => (typeof data === "string" ? new TextEncoder().encode(data).buffer : data),
    text: async () => (typeof data === "string" ? data : new TextDecoder().decode(data)),
  }) as unknown as File;

  it("reads an Excel sheet, converting date cells", async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Talent ID nominations"],
      ["First name", "Surname", "Date of birth", "Parent email", "Mobile"],
      ["Ava", "Brown", 43000, "brown@example.com", 7700900123],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const rows = await readSpreadsheet(fileOf("nominations.xlsx", buf));
    expect(rows[1]).toEqual(["First name", "Surname", "Date of birth", "Parent email", "Mobile"]);
    expect(rows[2]).toEqual(["Ava", "Brown", "2017-09-22", "brown@example.com", "7700900123"]);
    const sheet = analyseRows(rows, existing);
    expect(sheet.headerLine).toBe(1);
    expect(sheet.rows[0]).toMatchObject({ kind: "new", row: { first_name: "Ava", last_name: "Brown", age_group: "9U" } });
  });

  it("reads a CSV", async () => {
    const rows = await readSpreadsheet(fileOf("list.csv", "Name,Email\nAva Brown,brown@example.com\n", "text/csv"));
    expect(rows).toEqual([["Name", "Email"], ["Ava Brown", "brown@example.com"]]);
  });
});

describe("contact lists", () => {
  it("reads a schools list across sheets, cleaning a %20 address and skipping blanks", async () => {
    const { readContactList } = await import("../lib/rosterImport");
    const list = readContactList([
      { sheet: "Primary", rows: [["School", "Email"], ["Abbots Green Academy", "office@abbotsgreenacademy.co.uk"], ["St Felix", "%20office@sfstm.suffolk.sch.uk"], ["", ""], ["No Email School", ""]] },
      { sheet: "PRU", rows: [["PRU", "Email"], ["Alderwood", "adminalderwood@raedwaldtrust.org"], ["Dup", "OFFICE@abbotsgreenacademy.co.uk"]] },
      { sheet: "Notes", rows: [["Nothing here"]] },
    ]);
    expect(list).not.toBeNull();
    expect(list!.sheets.map((s) => [s.sheet, s.contacts.length])).toEqual([["Primary", 2], ["PRU", 1]]);
    expect(list!.sheets[0].contacts[1]).toMatchObject({ name: "St Felix", email: "office@sfstm.suffolk.sch.uk", line: 3 });
    expect(list!.fixed).toEqual([{ from: "%20office@sfstm.suffolk.sch.uk", to: "office@sfstm.suffolk.sch.uk", sheet: "Primary", line: 3 }]);
    expect(list!.missing).toEqual([{ name: "No Email School", sheet: "Primary", line: 5 }]);
    expect(list!.duplicates).toBe(1);
  });

  it("is not a contact list when there are no addresses", async () => {
    const { readContactList } = await import("../lib/rosterImport");
    expect(readContactList([{ sheet: "S", rows: [["Club"], ["Culford"]] }])).toBeNull();
  });
});

describe("extractEmails", () => {
  it("cleans mailto:, %20 and trailing punctuation, and reports what it can't use", async () => {
    const { extractEmails } = await import("../lib/emailList");
    const r = extractEmails("mailto:A@B.com, %20office@x.sch.uk; c@d.org. bad@nodot, e@f.co.uk?subject=hi");
    expect(r.valid).toEqual(["a@b.com", "office@x.sch.uk", "c@d.org", "e@f.co.uk"]);
    expect(r.invalid).toEqual(["bad@nodot"]);
  });
});
