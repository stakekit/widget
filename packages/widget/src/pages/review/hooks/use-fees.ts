import type { Prices } from "@sk-widget/domain/types";
import { bpsToAmount } from "@sk-widget/utils";
import { getFeesInUSD } from "@sk-widget/utils/formatters";
import type { FeeConfigurationDto, TokenDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Just, type Maybe } from "purify-ts";
import { useCallback, useMemo } from "react";

export const useFees = ({
  amount,
  feeConfigDto,
  prices,
  token,
}: {
  prices: Maybe<Prices>;
  token: Maybe<TokenDto>;
  amount: BigNumber;
  feeConfigDto: Maybe<FeeConfigurationDto>;
}) => {
  const getFee = useCallback(
    (fee: number) =>
      getFeesInUSD({
        amount: Just(bpsToAmount(BigNumber(fee), amount)),
        prices,
        token,
      }),
    [amount, token, prices]
  );

  const depositFeeUSD = useMemo(
    () => feeConfigDto.chainNullable((v) => v.depositFeeBps).map(getFee),
    [feeConfigDto, getFee]
  );

  const managementFeeUSD = useMemo(
    () => feeConfigDto.chainNullable((v) => v.managementFeeBps).map(getFee),
    [feeConfigDto, getFee]
  );

  const performanceFeeUSD = useMemo(
    () => feeConfigDto.chainNullable((v) => v.performanceFeeBps).map(getFee),
    [feeConfigDto, getFee]
  );

  return { depositFeeUSD, managementFeeUSD, performanceFeeUSD };
};
