import { ValidatorDto, YieldDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import {
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  createContext,
  useContext,
  useState,
} from "react";

type Data = Maybe<{
  selectedStake: YieldDto;
  stakeAmount: BigNumber;
  selectedValidator: Maybe<ValidatorDto>;
}>;

const StakeHistoryContext = createContext<
  [Data, Dispatch<SetStateAction<Data>>] | undefined
>(undefined);

export const StakeHistoryContextProvider = ({
  children,
}: PropsWithChildren) => {
  return (
    <StakeHistoryContext.Provider value={useState<Data>(Maybe.empty())}>
      {children}
    </StakeHistoryContext.Provider>
  );
};

const useStakeHistory = () => {
  const context = useContext(StakeHistoryContext);

  if (context === undefined) {
    throw new Error(
      "useStakeHistory must be used within a StakeHistoryContext"
    );
  }

  return context;
};

export const useStakeHistoryData = () => useStakeHistory()[0];
export const useSetStakeHistoryData = () => useStakeHistory()[1];
