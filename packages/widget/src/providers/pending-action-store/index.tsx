import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import { Maybe } from "purify-ts";
import type {
  ActionDto,
  YieldCreateManageActionDto,
} from "../../domain/types/action";
import type { AddressesDto } from "../../domain/types/addresses";
import type { YieldPendingActionType } from "../../domain/types/pending-action";
import type { TokenDto, YieldTokenDto } from "../../domain/types/tokens";
import type { Yield } from "../../domain/types/yields";

type PendingActionInitData = {
  requestDto: YieldCreateManageActionDto;
  addresses: AddressesDto;
  pendingActionType: YieldPendingActionType;
  integrationData: Yield;
  interactedToken: TokenDto | YieldTokenDto;
  gasFeeToken: TokenDto;
};

type PendingActionRequest = PendingActionInitData & {
  actionDto: Maybe<ActionDto>;
};

type PendingActionState = Maybe<PendingActionRequest>;

const pendingActionRequestAtom = Atom.make<PendingActionState>(
  Maybe.empty()
).pipe(Atom.keepAlive, Atom.withLabel("pendingActionRequestAtom"));

export const usePendingActionRequest = () =>
  useAtomValue(pendingActionRequestAtom);

export const useSetPendingActionRequest = () =>
  useAtomSet(pendingActionRequestAtom);
