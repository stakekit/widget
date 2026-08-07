import { Option } from "effect";
import type { PositionsData } from "../../../../../domain/types/positions";
import type {
  EarnMachineForm,
  EarnMachineIntent,
  EarnMachineView,
} from "../types";
import { disabledValidatorsViewResource } from "./view-inputs";

export const makeEmptyPositionsData = (): PositionsData => new Map();

const getIntentForm = (intent: EarnMachineIntent): EarnMachineForm => ({
  providerYieldId: intent.selectedProviderYieldId,
  stakeAmount: intent.stakeAmount,
  tronResource: intent.tronResource,
  useMaxAmount: intent.useMaxAmount,
});

export type EarnViewStage = {
  readonly availableCategories?: EarnMachineView["availableCategories"];
  readonly form?: EarnMachineForm;
  readonly resources?: Partial<EarnMachineView["resources"]>;
  readonly selection?: Partial<EarnMachineView["selection"]>;
};

export const makeEarnView = ({
  availableCategories = [],
  can,
  failure = null,
  form,
  intent,
  resources,
  retryTarget = null,
  selection,
  status,
}: EarnViewStage & {
  readonly can?: Partial<EarnMachineView["can"]>;
  readonly failure?: EarnMachineView["failure"];
  readonly intent: EarnMachineIntent;
  readonly retryTarget?: EarnMachineView["retryTarget"];
  readonly status: EarnMachineView["status"];
}): EarnMachineView => ({
  status,
  failure,
  retryTarget,
  availableCategories,
  selection: {
    category: null,
    token: null,
    validators: [],
    yield: null,
    ...selection,
  },
  form: form ?? getIntentForm(intent),
  resources: {
    positions: {
      data: makeEmptyPositionsData(),
      waiting: false,
    },
    tokenOptions: {
      items: [],
      waiting: false,
      pullKey: null,
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
  readonly intent: EarnMachineIntent;
  readonly previous: Option.Option<EarnMachineView>;
}): EarnMachineView => {
  if (Option.isSome(previous)) {
    return {
      ...previous.value,
      status: "resolving-wallet",
      failure: null,
      retryTarget: null,
      can: {
        selectToken: false,
        selectYield: false,
        selectValidator: false,
        submit: false,
      },
    };
  }

  return makeEarnView({
    intent,
    status: "resolving-wallet",
  });
};
