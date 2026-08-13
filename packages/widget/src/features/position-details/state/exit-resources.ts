import { Data, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { getKycProviderName } from "../../../domain/earn/kyc";
import { isYieldValidatorSelectionRequired } from "../../../domain/earn/yield";
import type { YieldId } from "../../../domain/identity/identifiers";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../../resources/yield-opportunity/provider";
import { getPullResultItems } from "../../../shared/effect/pagination";
import {
  YieldValidatorsKey,
  yieldValidatorsPullAtom,
} from "../../yield-entry/state";
import {
  CurrentYieldKycGateKey,
  currentYieldKycGateAtom,
  refreshCurrentYieldKycAtom,
} from "../../yield-summary/state";

export class PositionDetailsExitResourcesKey extends Data.Class<{
  readonly yieldId: YieldId | null;
}> {}

const selectedYieldAtom = Atom.family((key: PositionDetailsExitResourcesKey) =>
  Atom.make((get) =>
    get(
      yieldOpportunityAtom.foreground(
        new YieldOpportunityKey({ yieldId: key.yieldId })
      )
    ).pipe(AsyncResult.value, Option.getOrNull)
  )
);

const validatorsResourceAtom = Atom.family(
  (key: PositionDetailsExitResourcesKey) =>
    Atom.make((get) => {
      const selectedYield = get(selectedYieldAtom(key));
      return yieldValidatorsPullAtom(
        new YieldValidatorsKey({
          network: selectedYield?.token.network ?? null,
          search: null,
          yieldId:
            selectedYield && isYieldValidatorSelectionRequired(selectedYield)
              ? selectedYield.id
              : null,
        })
      );
    })
);

export const positionDetailsExitResourcesViewAtom = Atom.family(
  (key: PositionDetailsExitResourcesKey) =>
    Atom.make((get) => {
      const selectedYield = get(selectedYieldAtom(key));
      const shouldFetchValidators = Boolean(
        selectedYield && isYieldValidatorSelectionRequired(selectedYield)
      );
      const validatorResult = get(get(validatorsResourceAtom(key)));
      const validators = getPullResultItems(validatorResult).flatMap(
        (page) => page.items
      );
      const kyc = get(
        currentYieldKycGateAtom(
          new CurrentYieldKycGateKey({
            enabled: true,
            yieldDto: selectedYield,
          })
        )
      );

      return {
        hasMoreValidators: validatorResult.pipe(
          AsyncResult.value,
          Option.exists(({ done }) => !done)
        ),
        isLoadingMoreValidators:
          validatorResult.waiting && validators.length > 0,
        isValidatorsLoading:
          shouldFetchValidators && AsyncResult.isInitial(validatorResult),
        kyc: {
          gate: kyc.gate,
          isBlocking: kyc.isBlocking,
          isChecking: kyc.isChecking,
          providerName: getKycProviderName(selectedYield),
        },
        validators: shouldFetchValidators ? validators : [],
      } as const;
    })
);

export const loadMorePositionDetailsExitValidatorsAtom = Atom.family(
  (key: PositionDetailsExitResourcesKey) =>
    Atom.fnSync(
      (_input: undefined, context) => {
        const resource = context(validatorsResourceAtom(key));
        const result = context(resource);
        const hasMore = result.pipe(
          AsyncResult.value,
          Option.exists(({ done }) => !done)
        );
        if (!result.waiting && hasMore) {
          context.set(resource, undefined);
        }
      },
      { initialValue: undefined }
    )
);

export const refreshPositionDetailsExitKycAtom = Atom.family(
  (key: PositionDetailsExitResourcesKey) =>
    Atom.fnSync(
      (_input: undefined, context) => {
        const selectedYield = context(selectedYieldAtom(key));
        context.set(
          refreshCurrentYieldKycAtom(
            new CurrentYieldKycGateKey({
              enabled: true,
              yieldDto: selectedYield,
            })
          ),
          undefined
        );
      },
      { initialValue: undefined }
    )
);
