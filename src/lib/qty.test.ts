import { describe, expect, it } from "vitest";

import { qtyView } from "./qty";

describe("qtyView", () => {
  it("distinguishes unknown, exact, range and open-ended quantities", () => {
    expect(qtyView(undefined)).toEqual({ kind: "unknown" });
    expect(qtyView({ min: 3, max: 3 })).toEqual({ kind: "exact", n: 3 });
    expect(qtyView({ min: 20, max: 50 })).toEqual({ kind: "range", min: 20, max: 50 });
    expect(qtyView({ min: 2 })).toEqual({ kind: "atLeast", min: 2 });
  });
});
