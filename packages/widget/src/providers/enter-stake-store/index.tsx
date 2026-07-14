import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import type {
  ActionCommand,
  YieldAction,
} from "../../domain/schema/action-models";
import type { WalletAddresses } from "../../domain/schema/address-models";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../domain/schema/earn-models";
import type { AppToken } from "../../domain/schema/legacy-models";

import type { ValidatorKey } from "../../domain/types/validators";

type EnterStakeInitData = {
  requestDto: ActionCommand;
  addresses: WalletAddresses;
  gasFeeToken: EarnYieldWithProvider["token"];
  selectedStake: EarnYieldWithProvider;
  selectedValidators: Map<ValidatorKey, EarnValidator>;
  selectedToken: AppToken;
};

type EnterStakeRequest = EnterStakeInitData & {
  actionDto: YieldAction | null;
};

type EnterStakeState = EnterStakeRequest | null;

const enterStakeRequestAtom = Atom.make<EnterStakeState>(null).pipe(
  Atom.keepAlive,
  Atom.withLabel("enterStakeRequestAtom")
);

export const useEnterStakeRequest = () => useAtomValue(enterStakeRequestAtom);

export const useSetEnterStakeRequest = () => useAtomSet(enterStakeRequestAtom);
