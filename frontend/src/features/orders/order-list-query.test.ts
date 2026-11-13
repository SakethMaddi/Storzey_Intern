import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOrdersQuery } from "./order-list-query.ts";

describe("GET /orders query", () => {
  it("sends page, limit, and archived", () => {
    const params = new URLSearchParams(buildOrdersQuery({
      page: 2,
      archived: true,
      search: "",
      status: "ALL",
    }));
    assert.equal(params.get("page"), "2");
    assert.equal(params.get("limit"), "50");
    assert.equal(params.get("archived"), "true");
    assert.equal(params.get("search"), null);
    assert.equal(params.get("status"), null);
  });

  it("sends trimmed search and a real payment status", () => {
    const params = new URLSearchParams(buildOrdersQuery({
      page: 1,
      archived: false,
      search: "  Silk blouse  ",
      status: "PARTIALLY_PAID",
    }));
    assert.equal(params.get("search"), "Silk blouse");
    assert.equal(params.get("status"), "PARTIALLY_PAID");
    assert.equal(params.get("archived"), "false");
  });

  it("does not send ALL or OUTSTANDING as a payment status", () => {
    for (const status of ["ALL", "OUTSTANDING"]) {
      const params = new URLSearchParams(buildOrdersQuery({
        page: 1,
        archived: false,
        search: "",
        status,
      }));
      assert.equal(params.get("status"), null);
    }
  });

  it("caps search at 100 characters and rejects an invalid page", () => {
    const params = new URLSearchParams(buildOrdersQuery({
      page: 0,
      archived: false,
      search: "a".repeat(120),
      status: "PAID",
    }));
    assert.equal(params.get("page"), "1");
    assert.equal(params.get("search")?.length, 100);
    assert.equal(params.get("status"), "PAID");
  });
});
