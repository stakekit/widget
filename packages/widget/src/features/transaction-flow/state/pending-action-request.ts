import * as Atom from "effect/unstable/reactivity/Atom";
import type {
  ManageActionCommand,
  YieldAction,
} from "../../../domain/schema/action-models";
import type { WalletAddresses } from "../../../domain/schema/address-models";
import type { EarnYieldWithProvider } from "../../../domain/schema/earn-models";
import type { AppToken } from "../../../domain/schema/legacy-models";
import type { YieldPendingActionType } from "../../../domain/types/pending-action";

export type PendingActionRequest = {
  readonly actionDto: YieldAction | null;
  readonly addresses: WalletAddresses;
  readonly gasFeeToken: AppToken;
  readonly integrationData: EarnYieldWithProvider;
  readonly interactedToken: AppToken;
  readonly pendingActionType: YieldPendingActionType;
  readonly requestDto: ManageActionCommand;
};

export const pendingActionRequestAtom = Atom.make<PendingActionRequest | null>(
  null
).pipe(Atom.keepAlive, Atom.withLabel("pendingActionRequestAtom"));
