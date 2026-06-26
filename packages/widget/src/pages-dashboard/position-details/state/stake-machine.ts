import { useAtom } from "@effect/atom-react";
import { Data } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { TronResourceType } from "../../../domain/types/tron";

type PositionDetailsStakeEntryParams = {
  integrationId: string;
  balanceId: string;
};

class PositionDetailsStakeEntryKey extends Data.Class<PositionDetailsStakeEntryParams> {}

type PositionDetailsStakeIntent = {
  stakeAmount: string;
  tronResource: TronResourceType | null;
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
      tronResource: TronResourceType;
    };

const makeDefaultIntent = (): PositionDetailsStakeIntent => ({
  stakeAmount: "0",
  tronResource: null,
  useMaxAmount: false,
});

const positionDetailsStakeAtom = Atom.family(
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

export const usePositionDetailsStakeMachine = (
  entry: PositionDetailsStakeEntryParams
) => {
  const [intent, dispatch] = useAtom(
    positionDetailsStakeAtom(new PositionDetailsStakeEntryKey(entry))
  );

  return { intent, dispatch };
};
