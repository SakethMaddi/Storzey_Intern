import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatINR } from "../utils/currency.ts";
import { formatIndianPhone } from "../utils/phone.ts";
import { formatDate } from "../utils/date.ts";

describe("Utility Functions", () => {
  test("formatINR formats numbers with ₹ and Indian grouping", () => {
    assert.equal(formatINR(0), "₹0");
    assert.equal(formatINR(500), "₹500");
    assert.equal(formatINR(12500), "₹12,500");
    assert.equal(formatINR(1000000), "₹10,00,000");
    assert.equal(formatINR(null), "₹0");
    assert.equal(formatINR(undefined), "₹0");
  });

  test("formatIndianPhone formats 10-digit mobile numbers with space", () => {
    assert.equal(formatIndianPhone("9876543210"), "98765 43210");
    assert.equal(formatIndianPhone(""), "—");
    assert.equal(formatIndianPhone(null), "—");
  });

  test("formatDate formats YYYY-MM-DD cleanly", () => {
    const formatted = formatDate("2026-11-13T00:00:00.000Z");
    assert.match(formatted, /13.*Nov.*2026/);
    assert.equal(formatDate(null), "—");
  });
});
