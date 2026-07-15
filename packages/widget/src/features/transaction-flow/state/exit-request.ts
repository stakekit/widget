import type BigNumber from "bignumber.js";
import * as Atom from "effect/unstable/reactivity/Atom";
import type {
  ActionCommand,
  YieldAction,
} from "../../../domain/schema/action-models";
import type { WalletAddresses } from "../../../domain/schema/address-models";
import type { EarnYieldWithProvider } from "../../../domain/schema/earn-models";
import type { AppToken } from "../../../domain/schema/legacy-models";

export type ExitStakeRequest = {
  readonly actionDto: YieldAction | null;
  readonly addresses: WalletAddresses;
  readonly gasFeeToken: EarnYieldWithProvider["token"];
  readonly integrationData: EarnYieldWithProvider;
  readonly requestDto: ActionCommand;
  readonly unstakeAmount: BigNumber;
  readonly unstakeToken: AppToken;
};

export const exitStakeRequestAtom = Atom.make<ExitStakeRequest | null>(
  null
).pipe(Atom.keepAlive, Atom.withLabel("exitStakeRequestAtom"));
