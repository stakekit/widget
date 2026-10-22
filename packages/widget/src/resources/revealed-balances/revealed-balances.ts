import { Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import {
  fillConfidentialPosition,
  hasRevealedBalance,
} from "../../domain/earn/confidential";
import type { EarnBalance } from "../../domain/earn/models";
import type { YieldId } from "../../domain/identity/identifiers";
import { RevealedBalances } from "../../services/zama/revealed-balances";
import { TokenPricesKey, tokenPricesResourceAtom } from "../token-prices/index";
import { yieldOpportunityResourceAtom } from "../yield-opportunity/index";

export const revealedBalancesAtom = appRuntime
  .atom(
    RevealedBalances.use((values) => Effect.succeed(values.changes)).pipe(
      Stream.unwrap
    )
  )
  .pipe(Atom.withLabel("revealedBalancesAtom"));

// Only revealed yields read their cached opportunity and one shared price lookup.
export const fillRevealedPositions = <
  Position extends Readonly<{
    readonly balances: ReadonlyArray<EarnBalance>;
    readonly yieldId: YieldId;
  }>,
>(
  get: Atom.AtomContext,
  positions: ReadonlyArray<Position>
): ReadonlyArray<Position> => {
  const handles = AsyncResult.value(get(revealedBalancesAtom)).pipe(
    Option.match({
      onNone: () => new Map(),
      onSome: (values) => values.handles,
    })
  );
  const yieldIds = [
    ...new Set(
      positions
        .filter((position) => hasRevealedBalance(position, handles))
        .map((position) => position.yieldId)
    ),
  ];
  if (yieldIds.length === 0) return positions;

  const yields = new Map(
    yieldIds.flatMap((yieldId) =>
      AsyncResult.value(get(yieldOpportunityResourceAtom.local(yieldId))).pipe(
        Option.match({
          onNone: () => [],
          onSome: (yieldDto) => [[yieldId, yieldDto] as const],
        })
      )
    )
  );
  const prices =
    yields.size === 0
      ? null
      : AsyncResult.value(
          get(
            tokenPricesResourceAtom.local(
              new TokenPricesKey({
                currency: "USD",
                tokenList: [...yields.values()].map(({ token }) => token),
              })
            )
          )
        ).pipe(Option.getOrNull);

  return positions.map((position) => {
    const yieldDto = yields.get(position.yieldId);
    return fillConfidentialPosition(
      position,
      handles,
      yieldDto
        ? {
            usdPrice: prices?.getByToken(yieldDto.token)?.price ?? null,
            yieldDto,
          }
        : null
    );
  });
};
