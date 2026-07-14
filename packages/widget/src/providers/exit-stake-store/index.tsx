import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type BigNumber from "bignumber.js";
import * as Atom from "effect/unstable/reactivity/Atom";
import type {
  ActionCommand,
  YieldAction,
} from "../../domain/schema/action-models";
import type { WalletAddresses } from "../../domain/schema/address-models";
import type { EarnYieldWithProvider } from "../../domain/schema/earn-models";
import type { AppToken } from "../../domain/schema/legacy-models";

type ExitStakeInitData = {
  requestDto: ActionCommand;
  addresses: WalletAddresses;
  gasFeeToken: EarnYieldWithProvider["token"];
  unstakeAmount: BigNumber;
  integrationData: EarnYieldWithProvider;
  unstakeToken: AppToken;
};

type ExitStakeRequest = ExitStakeInitData & {
  actionDto: YieldAction | null;
};

type ExitStakeState = ExitStakeRequest | null;

const exitStakeRequestAtom = Atom.make<ExitStakeState>(null).pipe(
  Atom.keepAlive,
  Atom.withLabel("exitStakeRequestAtom")
);

export const useExitStakeRequest = () => useAtomValue(exitStakeRequestAtom);

export const useSetExitStakeRequest = () => useAtomSet(exitStakeRequestAtom);
