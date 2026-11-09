import { Cause, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";

import {
  derivePositionsPageState,
  type PositionsPageSources,
  toWalletConnection,
  type WalletConnection,
} from "../../../src/features/portfolio/model/positions-page";
import { toPresentable } from "../../../src/shared/effect/async-result";

const positions = (count: number) =>
  Array.from({ length: count }, (_, index) => index);
const ready = (count = 0, options?: { readonly waiting?: boolean }) =>
  toPresentable(AsyncResult.success(positions(count), options));
const loading = toPresentable(AsyncResult.initial(true));
const failed = toPresentable(
  AsyncResult.failure<ReadonlyArray<number>, string>(Cause.fail("offline"))
);
const refreshFailed = (count: number) =>
  toPresentable(
    AsyncResult.failure(Cause.fail("offline"), {
      previousSuccess: Option.some(AsyncResult.success(positions(count))),
    })
  );

const rows = ["row"];

const getState = ({
  connection = "connected",
  reportsPartialFailure = true,
  ...sources
}: Partial<PositionsPageSources> & {
  readonly connection?: WalletConnection;
  readonly reportsPartialFailure?: boolean;
} = {}) =>
  derivePositionsPageState({
    connection,
    reportsPartialFailure,
    rows,
    sources: { borrow: ready(), earn: ready(), ...sources },
  });

describe("positions page state", () => {
  it("treats a wallet still loading or connecting as connecting", () => {
    expect(toWalletConnection(null)).toBe("connecting");
    expect(toWalletConnection("connecting")).toBe("connecting");
    expect(getState({ connection: "connecting", earn: ready(2) })).toEqual({
      _tag: "Connecting",
    });
  });

  it("asks for a wallet when none is connected or it is unsupported", () => {
    expect(toWalletConnection("disconnected")).toBe("disconnected");
    expect(toWalletConnection("unsupported")).toBe("disconnected");
    expect(getState({ connection: "disconnected", earn: failed })).toEqual({
      _tag: "Disconnected",
    });
  });

  it("lists Earn positions while Borrow failed, flagging the partial failure", () => {
    expect(getState({ borrow: failed, earn: ready(2) })).toEqual({
      _tag: "Ready",
      partialFailure: true,
      rows,
      total: 2,
    });
  });

  it("reports a failed source while another still loads with nothing listed", () => {
    expect(getState({ borrow: loading, earn: failed })).toEqual({
      _tag: "Ready",
      partialFailure: true,
      rows,
      total: 0,
    });
  });

  it("counts Earn and Borrow positions together", () => {
    expect(getState({ borrow: ready(1), earn: ready(2) })).toMatchObject({
      _tag: "Ready",
      partialFailure: false,
      total: 3,
    });
  });

  it("lists Borrow positions while Earn still loads", () => {
    expect(getState({ borrow: ready(1), earn: loading })).toMatchObject({
      _tag: "Ready",
      total: 1,
    });
  });

  it("loads while Earn loads and nothing is listed yet", () => {
    expect(getState({ earn: loading })).toEqual({ _tag: "Loading" });
    expect(getState({ borrow: null, earn: loading })).toEqual({
      _tag: "Loading",
    });
  });

  it("lists Earn's empty result while Borrow still loads, without the empty state", () => {
    expect(getState({ borrow: loading, earn: ready(0) })).toEqual({
      _tag: "Ready",
      partialFailure: false,
      rows,
      total: 0,
    });
  });

  it("is empty only once every source loaded without positions", () => {
    expect(getState()).toEqual({ _tag: "Empty", rows });
    expect(getState({ earn: ready(0, { waiting: true }) })).toEqual({
      _tag: "Empty",
      rows,
    });
  });

  it("fails when every active source failed", () => {
    expect(getState({ borrow: failed, earn: failed })).toEqual({
      _tag: "Failed",
    });
    expect(getState({ borrow: null, earn: failed })).toEqual({
      _tag: "Failed",
    });
  });

  it("keeps the list over a failed source with nothing loaded instead of the empty state", () => {
    expect(getState({ earn: failed })).toMatchObject({
      _tag: "Ready",
      partialFailure: true,
      total: 0,
    });
  });

  it("keeps positions over a failed refetch and flags the list incomplete", () => {
    expect(getState({ borrow: null, earn: refreshFailed(2) })).toMatchObject({
      _tag: "Ready",
      partialFailure: true,
      total: 2,
    });
    expect(getState({ borrow: null, earn: refreshFailed(0) })).toMatchObject({
      _tag: "Ready",
      partialFailure: true,
    });
  });

  it("stays empty over a failed refetch where the page does not report it", () => {
    expect(
      getState({
        borrow: null,
        earn: refreshFailed(0),
        reportsPartialFailure: false,
      })
    ).toEqual({ _tag: "Empty", rows });
    expect(
      getState({
        borrow: null,
        earn: refreshFailed(2),
        reportsPartialFailure: false,
      })
    ).toMatchObject({ _tag: "Ready", partialFailure: false, total: 2 });
  });

  it("keeps positions listed while a source refreshes", () => {
    expect(
      getState({ borrow: ready(1, { waiting: true }), earn: ready(1) })
    ).toMatchObject({
      _tag: "Ready",
      partialFailure: false,
      total: 2,
    });
  });
});
