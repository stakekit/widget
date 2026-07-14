import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import type {
  ManageActionCommand,
  YieldAction,
} from "../../domain/schema/action-models";
import type { WalletAddresses } from "../../domain/schema/address-models";
import type { EarnYieldWithProvider } from "../../domain/schema/earn-models";
import type { AppToken } from "../../domain/schema/legacy-models";

import type { YieldPendingActionType } from "../../domain/types/pending-action";

type PendingActionInitData = {
  requestDto: ManageActionCommand;
  addresses: WalletAddresses;
  pendingActionType: YieldPendingActionType;
  integrationData: EarnYieldWithProvider;
  interactedToken: AppToken;
  gasFeeToken: AppToken;
};

type PendingActionRequest = PendingActionInitData & {
  actionDto: YieldAction | null;
};

type PendingActionState = PendingActionRequest | null;

const pendingActionRequestAtom = Atom.make<PendingActionState>(null).pipe(
  Atom.keepAlive,
  Atom.withLabel("pendingActionRequestAtom")
);

export const usePendingActionRequest = () =>
  useAtomValue(pendingActionRequestAtom);

export const useSetPendingActionRequest = () =>
  useAtomSet(pendingActionRequestAtom);
