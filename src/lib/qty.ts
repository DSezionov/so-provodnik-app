import type { Qty } from "../data/types";

export type QtyView =
  | { kind: "unknown" }
  | { kind: "exact"; n: number }
  | { kind: "range"; min: number; max: number }
  | { kind: "atLeast"; min: number };

/** How a quantity should be shown: «3 шт.», «20–50 шт.», «от 2 шт.» or «? шт.». */
export function qtyView(qty: Qty | undefined): QtyView {
  if (!qty) return { kind: "unknown" };
  if (qty.max === undefined) return { kind: "atLeast", min: qty.min };
  if (qty.max === qty.min) return { kind: "exact", n: qty.min };
  return { kind: "range", min: qty.min, max: qty.max };
}
