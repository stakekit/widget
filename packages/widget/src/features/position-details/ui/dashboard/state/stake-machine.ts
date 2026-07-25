import { Data } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { YieldId } from "../../../../../domain/schema/identifiers";
import type { TronResource } from "../../../../../domain/schema/legacy-models";
import type { WalletScopeKey } from "../../../../../services/wallet/domain/scope";

type PositionDetailsStakeEntryParams = {
  integrationId: YieldId;
  balanceId: string;
  walletScope: WalletScopeKey;
};

export class PositionDetailsStakeEntryKey extends Data.Class<PositionDetailsStakeEntryParams> {}

type PositionDetailsStakeIntent = {
  stakeAmount: string;
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
    };

const makeDefaultIntent = (): PositionDetailsStakeIntent => ({
  stakeAmount: "0",
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
        }
      }
    );
  }
);
