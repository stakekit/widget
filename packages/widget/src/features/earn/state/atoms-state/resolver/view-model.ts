import { Option } from "effect";
import type * as Atom from "effect/unstable/reactivity/Atom";
import type { PositionsData } from "../../../../../domain/types/positions";
import type {
  EarnMachineForm,
  EarnMachineIntent,
  EarnMachineView,
} from "../types";
import {
  disabledValidatorsViewResource,
  pendingTokenOptionsPullAtom,
} from "./view-inputs";

const makeEmptyPositionsData = (): PositionsData => new Map();

const getIntentForm = (intent: EarnMachineIntent): EarnMachineForm => ({
  providerYieldId: intent.selectedProviderYieldId,
  stakeAmount: intent.stakeAmount,
  tronResource: intent.tronResource,
  useMaxAmount: intent.useMaxAmount,
});

export const makeEarnView = ({
  availableCategories = [],
  can,
  failure = null,
  form,
  intent,
  resources,
  retryTargetAtom = null,
  selection,
  status,
}: {
  readonly availableCategories?: EarnMachineView["availableCategories"];
  readonly can?: Partial<EarnMachineView["can"]>;
  readonly failure?: EarnMachineView["failure"];
  readonly form?: EarnMachineForm;
  readonly intent: EarnMachineIntent;
  readonly resources?: Partial<EarnMachineView["resources"]>;
  readonly retryTargetAtom?: Atom.Atom<unknown> | null;
  readonly selection?: Partial<EarnMachineView["selection"]>;
  readonly status: EarnMachineView["status"];
}): EarnMachineView => ({
  status,
  failure,
  retryTargetAtom,
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
      pullAtom: pendingTokenOptionsPullAtom,
    },
    validators: disabledValidatorsViewResource,
    yields: {
      items: [],
      waiting: false,
    },
    ...resources,
  },
  can: {
    selectToken: false,
    selectYield: false,
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
      retryTargetAtom: null,
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
