import { Option } from "effect";
import type { Presentable } from "../../../shared/effect/async-result";

/** The wallet as a positions page sees it. */
export type WalletConnection = "connected" | "connecting" | "disconnected";

/**
 * A wallet status, or null while the wallet state has not loaded yet. An
 * unsupported wallet lists nothing, like a disconnected one.
 */
export const toWalletConnection = (
  status: "connected" | "connecting" | "disconnected" | "unsupported" | null
): WalletConnection => {
  if (status === null || status === "connecting") return "connecting";
  if (status === "connected") return "connected";
  return "disconnected";
};

type PositionsSource = Presentable<ReadonlyArray<unknown>, unknown>;

/**
 * The positions a page lists. `borrow` is null when the page lists Earn
 * positions only, or when Borrow is inactive for the wallet.
 */
export type PositionsPageSources = {
  readonly borrow: PositionsSource | null;
  readonly earn: PositionsSource;
};

/**
 * What a positions page shows. `Failed` means every source failed with nothing
 * to show; `retryPositionsAtom` loads them again. `Empty` and `Ready` list
 * `rows`; `Ready` counts the listed positions in `total` and flags
 * `partialFailure` when the page reports a source that failed or whose
 * refetch did.
 */
export type PositionsPageState<Row> =
  | { readonly _tag: "Disconnected" }
  | { readonly _tag: "Connecting" }
  | { readonly _tag: "Loading" }
  | { readonly _tag: "Failed" }
  | { readonly _tag: "Empty"; readonly rows: ReadonlyArray<Row> }
  | {
      readonly _tag: "Ready";
      readonly partialFailure: boolean;
      readonly rows: ReadonlyArray<Row>;
      readonly total: number;
    };

/**
 * Selects a positions page's state from the wallet and its sources. `rows`
 * renders the sources' loaded positions. A page that reports partial failures
 * (`reportsPartialFailure`) keeps its list, flagged, over a failure even with
 * nothing listed. With nothing listed, the page blocks on loading until Earn
 * loaded; once it has, a Borrow source still loading keeps the list on screen
 * rather than the empty state, which waits for every source.
 */
export const derivePositionsPageState = <Row>({
  connection,
  reportsPartialFailure,
  rows,
  sources,
}: {
  readonly connection: WalletConnection;
  readonly reportsPartialFailure: boolean;
  readonly rows: ReadonlyArray<Row>;
  readonly sources: PositionsPageSources;
}): PositionsPageState<Row> => {
  if (connection === "disconnected") return { _tag: "Disconnected" };
  if (connection === "connecting") return { _tag: "Connecting" };

  const active = sources.borrow
    ? [sources.earn, sources.borrow]
    : [sources.earn];
  if (active.every((source) => source._tag === "Failed")) {
    return { _tag: "Failed" };
  }

  const total = active.reduce(
    (sum, source) => sum + (source._tag === "Ready" ? source.value.length : 0),
    0
  );
  const partialFailure =
    reportsPartialFailure &&
    active.some(
      (source) =>
        source._tag === "Failed" ||
        (source._tag === "Ready" && Option.isSome(source.refreshFailure))
    );

  if (total === 0 && !partialFailure) {
    if (!active.some((source) => source._tag === "Loading")) {
      return { _tag: "Empty", rows };
    }
    if (sources.earn._tag !== "Ready") return { _tag: "Loading" };
  }

  return { _tag: "Ready", partialFailure, rows, total };
};
