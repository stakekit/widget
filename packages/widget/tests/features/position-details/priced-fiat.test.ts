import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";
import { exactDecimal } from "../../../src/domain/finance/exact";
import { getPricedFiat } from "../../../src/features/position-details/model/priced-fiat";
import { toPresentable } from "../../../src/shared/effect/async-result";

const tenUsd = exactDecimal("10");

const fiatFor = (prices: AsyncResult.AsyncResult<unknown, unknown>) =>
  getPricedFiat({
    amountUsd: tenUsd,
    locale: "en",
    status: toPresentable(prices)._tag,
  });

describe("an amount's fiat figure valued by prices", () => {
  it("holds a placeholder while prices load", () => {
    expect(fiatFor(AsyncResult.initial(true))).toEqual({
      fiatValue: "",
      fiatValueLoading: true,
    });
  });

  it("holds a placeholder while prices are retried after a failure", () => {
    expect(fiatFor(AsyncResult.fail("down", { waiting: true }))).toEqual({
      fiatValue: "",
      fiatValueLoading: true,
    });
  });

  it("shows the figure once prices are in", () => {
    expect(fiatFor(AsyncResult.success(null))).toEqual({
      fiatValue: "$10.00",
      fiatValueLoading: false,
    });
  });

  it("reads as unavailable when prices failed with nothing to fall back on", () => {
    expect(fiatFor(AsyncResult.fail("down"))).toEqual({
      fiatValue: "—",
      fiatValueLoading: false,
    });
  });

  it("keeps valuing with the last prices after a refresh fails", () => {
    expect(
      fiatFor(
        AsyncResult.fail("down", {
          previousSuccess: Option.some(AsyncResult.success(null)),
        })
      )
    ).toEqual({ fiatValue: "$10.00", fiatValueLoading: false });
  });

  it("shows no figure when prices are in but the amount has none", () => {
    expect(
      getPricedFiat({ amountUsd: null, locale: "en", status: "Ready" })
    ).toEqual({ fiatValue: "", fiatValueLoading: false });
  });
});
