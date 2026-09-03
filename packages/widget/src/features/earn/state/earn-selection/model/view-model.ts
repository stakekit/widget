import { Option } from "effect";
import type { PositionsData } from "../../../../../domain/portfolio/positions";
import type {
  EarnEntryIntent,
  EarnSelectionForm,
  EarnSelectionView,
} from "../types";
import { disabledValidatorsViewResource } from "./view-inputs";

export const makeEmptyPositionsData = (): PositionsData => new Map();

const getIntentForm = (intent: EarnEntryIntent): EarnSelectionForm => ({
  providerYieldId: intent.selectedProviderYieldId,
  stakeAmount: intent.stakeAmount,
  tronResource: intent.tronResource,
  useMaxAmount: intent.useMaxAmount,
});

export type EarnViewFacts = {
  readonly availableCategories?: EarnSelectionView["availableCategories"];
  readonly blockingFailure?: boolean;
  readonly can?: Partial<EarnSelectionView["can"]>;
  readonly empty?: Partial<EarnSelectionView["empty"]>;
  readonly form?: EarnSelectionForm;
  readonly loading?: Partial<EarnSelectionView["loading"]>;
  readonly resources?: Partial<EarnSelectionView["resources"]>;
  readonly selection?: Partial<EarnSelectionView["selection"]>;
};

export const makeEarnView = ({
  availableCategories = [],
  blockingFailure = false,
  can,
  empty,
  form,
  intent,
  loading,
  resources,
  selection,
}: EarnViewFacts & {
  readonly intent: EarnEntryIntent;
}): EarnSelectionView => ({
  availableCategories,
  blockingFailure,
  selection: {
    category: null,
    token: null,
    validators: [],
    yield: null,
    ...selection,
  },
  form: form ?? getIntentForm(intent),
  loading: {
    wallet: false,
    categories: false,
    initialSelection: false,
    tokens: false,
    yields: false,
    positions: false,
    validators: false,
    ...loading,
  },
  empty: {
    categories: false,
    tokens: false,
    yields: false,
    validators: false,
    ...empty,
  },
  resources: {
    positions: {
      data: makeEmptyPositionsData(),
      waiting: false,
    },
    tokenOptions: {
      items: [],
      waiting: false,
    },
    validators: disabledValidatorsViewResource,
    yields: {
      items: [],
      waiting: false,
    },
    ...resources,
  },
  can: {
    selectToken: (resources?.tokenOptions?.items.length ?? 0) > 0,
    selectYield: (resources?.yields?.items.length ?? 0) > 0,
    selectValidator: false,
    submit: false,
    ...can,
  },
});

export const makeResolvingWalletView = ({
  intent,
  previous,
}: {
  readonly intent: EarnEntryIntent;
  readonly previous: Option.Option<EarnSelectionView>;
}): EarnSelectionView => {
  if (Option.isSome(previous)) {
    return {
      ...previous.value,
      blockingFailure: false,
      loading: { ...previous.value.loading, wallet: true },
      can: {
        selectToken: false,
        selectYield: false,
        selectValidator: false,
        submit: false,
      },
    };
  }

  return makeEarnView({ intent, loading: { wallet: true } });
};
