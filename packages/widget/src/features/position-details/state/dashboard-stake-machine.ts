import { Data } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type { TronResource } from "../../../domain/action/tron-resource";
import type { YieldId } from "../../../domain/identity/identifiers";
import type { Token } from "../../../domain/token/token";
import type { WalletScopeKey } from "../../../domain/wallet/wallet-scope";

type PositionDetailsStakeEntryParams = {
  integrationId: YieldId;
  balanceId: string;
  walletScope: WalletScopeKey;
};

export class PositionDetailsStakeEntryKey extends Data.Class<PositionDetailsStakeEntryParams> {}

type PositionDetailsStakeIntent = {
  stakeAmount: string;
  /** Null keeps the yield token. */
  token: Token | null;
  tronResource: TronResource | null;
  useMaxAmount: boolean;
};

type PositionDetailsStakeAction =
  | {
      type: "stakeAmount/change";
      amount: string;
    }
  | {
      type: "stakeAmount/max";
      amount: string;
    }
  | {
      type: "tronResource/select";
      tronResource: TronResource;
    }
  | {
      type: "token/select";
      token: Token;
    };

const makeDefaultIntent = (): PositionDetailsStakeIntent => ({
  stakeAmount: "0",
  token: null,
  tronResource: null,
  useMaxAmount: false,
});

export const positionDetailsStakeAtom = Atom.family(
  (_entry: PositionDetailsStakeEntryKey) => {
    const intentAtom = Atom.make<PositionDetailsStakeIntent>(
      makeDefaultIntent()
    );

    return Atom.writable<
      PositionDetailsStakeIntent,
      PositionDetailsStakeAction
    >(
      (ctx) => ctx.get(intentAtom),
      (ctx, action) => {
        const intent = ctx.get(intentAtom);

        switch (action.type) {
          case "stakeAmount/change":
            ctx.set(intentAtom, {
              ...intent,
              stakeAmount: action.amount,
              useMaxAmount: false,
            });
            return;
          case "stakeAmount/max":
            ctx.set(intentAtom, {
              ...intent,
              stakeAmount: action.amount,
              useMaxAmount: true,
            });
            return;
          case "tronResource/select":
            ctx.set(intentAtom, {
              ...intent,
              tronResource: action.tronResource,
            });
            return;
          // An amount in the previous token means nothing in the new one.
          case "token/select":
            ctx.set(intentAtom, {
              ...intent,
              stakeAmount: "0",
              token: action.token,
              useMaxAmount: false,
            });
            return;
        }
      }
    );
  }
);
