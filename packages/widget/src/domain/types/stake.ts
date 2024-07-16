import { tokenString } from "@sk-widget/domain";
import type {
  AmountArgumentOptionsDto,
  TokenBalanceScanResponseDto,
  YieldDto,
} from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import type { Maybe } from "purify-ts";
import { List } from "purify-ts";
import type { InitParams } from "./init-params";

const amountGreaterThanZero = (val: TokenBalanceScanResponseDto) =>
  new BigNumber(val.amount).isGreaterThan(0);

const hasYields = (val: TokenBalanceScanResponseDto) =>
  !!val.availableYields.length;

const hasYieldsAndAmount = (val: TokenBalanceScanResponseDto) =>
  hasYields(val) && amountGreaterThanZero(val);

export const getInitialToken = (args: {
  initQueryParams: Maybe<InitParams>;
  tokenBalances: TokenBalanceScanResponseDto[];
  defaultTokens: TokenBalanceScanResponseDto[];
}) =>
  /**
   * TB based on query params
   */
  args.initQueryParams
    .filter((val) => !!val.token)
    .chain((val) =>
      List.find(
        (t) =>
          (t.token.symbol === val.token && t.token.network === val.network) ||
          tokenString(t.token) === val.token,
        [...args.tokenBalances, ...args.defaultTokens]
      )
    )
    /**
     * TB based on first token with available yields and amount > 0
     */
    .altLazy(() => List.find(hasYieldsAndAmount, args.tokenBalances))
    /**
     * TB based on first token with available yields
     */
    .altLazy(() => List.find(hasYields, args.tokenBalances))
    .altLazy(() => List.find(hasYields, args.defaultTokens))
    .map((val) => val.token);

const yieldTypeOrder: { [Key in YieldDto["metadata"]["type"]]: number } = {
  staking: 1,
  restaking: 2,
  "liquid-staking": 3,
  vault: 4,
  lending: 5,
};

export const getInitialYield = (args: {
  initQueryParams: Maybe<InitParams>;
  yieldDtos: YieldDto[];
  tokenBalanceAmount: BigNumber;
}) => {
  const sortedYields = args.yieldDtos.toSorted(
    (a, b) =>
      yieldTypeOrder[a.metadata.type] - yieldTypeOrder[b.metadata.type] ||
      getInitMinStakeAmount(b).minus(getInitMinStakeAmount(a)).toNumber()
  );

  return args.initQueryParams
    .filter((val) => !!val.yieldId)
    .chain((val) => List.find((y) => val.yieldId === y.id, sortedYields))
    .altLazy(() =>
      List.find(
        (yieldDto) =>
          balanceValidForYield({
            tokenBalanceAmount: args.tokenBalanceAmount,
            yieldDto,
          }),
        sortedYields
      )
    )
    .altLazy(() => List.head(sortedYields));
};

const balanceValidForYield = ({
  tokenBalanceAmount,
  yieldDto,
}: {
  tokenBalanceAmount: BigNumber;
  yieldDto: YieldDto;
}) =>
  tokenBalanceAmount.isGreaterThanOrEqualTo(getInitMinStakeAmount(yieldDto));

export const getInitMinStakeAmount = (yieldDto: YieldDto) =>
  new BigNumber(yieldDto.args.enter.args?.amount?.minimum ?? 0);

export const getInitSelectedValidators = (args: {
  initQueryParams: Maybe<InitParams>;
  yieldDto: YieldDto;
}) =>
  args.initQueryParams
    .chainNullable((params) => params.validator)
    .chain((initV) =>
      List.find(
        (val) => val.name === initV || val.address === initV,
        args.yieldDto.validators
      )
    )
    .altLazy(() => List.head(args.yieldDto.validators))
    .map((v) => new Map([[v.address, v]]))
    .orDefault(new Map());

export const isForceMaxAmount = (args: AmountArgumentOptionsDto) =>
  args.minimum === -1 && args.maximum === -1;
