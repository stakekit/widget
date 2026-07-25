import * as Atom from "effect/unstable/reactivity/Atom";
import {
  sameWalletScopeOwner,
  WalletScopeKey,
} from "../../../services/wallet/domain/scope";
import { walletScopeAtom } from "../../wallet/state";
import type { BorrowTransactionFlowIntake } from "../model/borrow-transaction-flow";

export type BorrowFlowSession = Readonly<{
  readonly epoch: number;
  readonly intake: BorrowTransactionFlowIntake;
  readonly walletScope: WalletScopeKey;
}>;

type BorrowFlowSessionStoreState = Readonly<{
  readonly current: BorrowFlowSession | null;
  readonly nextEpoch: number;
}>;

const initialState: BorrowFlowSessionStoreState = {
  current: null,
  nextEpoch: 1,
};

const copyIntake = (
  intake: BorrowTransactionFlowIntake
): BorrowTransactionFlowIntake => structuredClone(intake);

export const makeBorrowFlowSessionStore = () => {
  const stateAtom = Atom.make<BorrowFlowSessionStoreState>(initialState).pipe(
    Atom.keepAlive,
    Atom.withLabel("borrowFlowSessionStoreAtom")
  );
  const currentSessionAtom = Atom.make((get) => get(stateAtom).current).pipe(
    Atom.withLabel("currentBorrowFlowSessionAtom")
  );
  const startAtom = Atom.fnSync(
    (intake: BorrowTransactionFlowIntake, context) => {
      const walletScope = context(walletScopeAtom);
      if (
        !walletScope ||
        !sameWalletScopeOwner(walletScope, {
          address: intake.request.address,
          network: intake.summary.network,
        })
      ) {
        return null;
      }

      const state = context(stateAtom);
      const session: BorrowFlowSession = {
        epoch: state.nextEpoch,
        intake: copyIntake(intake),
        walletScope: new WalletScopeKey(walletScope),
      };
      context.set(stateAtom, {
        current: session,
        nextEpoch: state.nextEpoch + 1,
      });
      return session;
    }
  ).pipe(Atom.withLabel("startBorrowFlowSessionAtom"));
  const clearAtom = Atom.fnSync((epoch: number, context) => {
    const state = context(stateAtom);
    if (state.current?.epoch !== epoch) return;
    context.set(stateAtom, { ...state, current: null });
  }).pipe(Atom.withLabel("clearBorrowFlowSessionAtom"));

  return { clearAtom, currentSessionAtom, startAtom, stateAtom } as const;
};

export const borrowFlowSessionStore = makeBorrowFlowSessionStore();
