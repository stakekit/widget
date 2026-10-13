import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type { EarnYieldWithProvider } from "../../../domain/earn/models";
import {
  ProviderId,
  type ProviderOption,
} from "../../../domain/identity/identifiers";
import { enrichedYieldOpportunityResourceAtom } from "../../../resources/yield-opportunity/index";
import { yieldProviderResourceAtom } from "../../../resources/yield-provider/index";
import type { EarnProviderOption } from "./earn-selection/types";

/** A `providerId` option with its provider details once they resolve. */
export const earnProviderOptionAtom = Atom.family((value: ProviderOption) =>
  Atom.make(
    (get): EarnProviderOption => ({
      provider: get(
        yieldProviderResourceAtom.local(ProviderId.make(value))
      ).pipe(AsyncResult.value, Option.flatten, Option.getOrNull),
      value,
    })
  ).pipe(Atom.withLabel("earnProviderOptionAtom"))
);

/**
 * The Yield a started flow executes against, looked up by the captured id
 * rather than through the Earn selection, so catalog refreshes and selection
 * fallbacks cannot replace it. The captured snapshot stands in while the live
 * Yield is unavailable, and keeps its provider if live enrichment lacks one.
 */
export const earnFlowYieldAtom = Atom.family(
  (captured: EarnYieldWithProvider) =>
    Atom.make((get): EarnYieldWithProvider => {
      const live = get(
        enrichedYieldOpportunityResourceAtom.local(captured.id)
      ).pipe(AsyncResult.value, Option.getOrNull);
      if (!live) return captured;
      if (live.provider === undefined && captured.provider !== undefined) {
        return { ...live, provider: captured.provider };
      }
      return live;
    }).pipe(Atom.withLabel("earnFlowYieldAtom"))
);

/**
 * The provider option a started flow executes with: live provider details,
 * else those captured when the flow started.
 */
export const earnFlowProviderOptionAtom = Atom.family(
  (captured: EarnProviderOption) =>
    Atom.make(
      (get): EarnProviderOption => ({
        provider:
          get(earnProviderOptionAtom(captured.value)).provider ??
          captured.provider,
        value: captured.value,
      })
    ).pipe(Atom.withLabel("earnFlowProviderOptionAtom"))
);
