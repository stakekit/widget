import { Data } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type { TronResource } from "../../../domain/action/tron-resource";
import type { YieldId } from "../../../domain/identity/identifiers";
import type { BalanceDataKey } from "../../../domain/portfolio/positions";
import type { Token } from "../../../domain/token/token";
import type { WalletScopeKey } from "../../../domain/wallet/wallet-scope";

type PositionDetailsEnterParams = {
  integrationId: YieldId;
  balanceId: BalanceDataKey;
  walletScope: WalletScopeKey;
};

export class PositionDetailsEnterKey extends Data.Class<PositionDetailsEnterParams> {}

type PositionDetailsEnterIntent = {
  stakeAmount: string;
  /** Null keeps the yield token. */
  token: Token | null;
  tronResource: TronResource | null;
  useMaxAmount: boolean;
};

type PositionDetailsEnterAction =
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

const makeDefaultIntent = (): PositionDetailsEnterIntent => ({
  stakeAmount: "0",
  token: null,
  tronResource: null,
  useMaxAmount: false,
});

export const positionDetailsEnterAtom = Atom.family(
  (_entry: PositionDetailsEnterKey) => {
    const intentAtom = Atom.make<PositionDetailsEnterIntent>(
      makeDefaultIntent()
    );

    return Atom.writable<
      PositionDetailsEnterIntent,
      PositionDetailsEnterAction
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
