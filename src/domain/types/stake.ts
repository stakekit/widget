import type {
  TokenBalanceScanResponseDto,
  YieldDto,
} from "@stakekit/api-hooks";
import type { Maybe } from "purify-ts";
import { List } from "purify-ts";
import type { QueryParams } from "./query-params";
import BigNumber from "bignumber.js";

export const getInitialToken = (args: {
  initQueryParams: Maybe<QueryParams>;
  tokenBalances: TokenBalanceScanResponseDto[];
  defaultTokens: TokenBalanceScanResponseDto[];
}) =>
  /**
   * TB based on query params
   */
  args.initQueryParams
    .filter((val) => !!(val.network && val.token))
    .chain((val) =>
      List.find(
        (t) => t.token.symbol === val.token && t.token.network === val.network,
        [...args.tokenBalances, ...args.defaultTokens]
      )
    )
    /**
     * TB based on first token with available yields and amount > 0
     */
    .altLazy(() =>
      List.find(
        (v) =>
          !!v.availableYields.length &&
          new BigNumber(v.amount).isGreaterThan(0),
        args.tokenBalances
      )
    )
    /**
     * TB based on first token with available yields
     */
    .altLazy(() =>
      List.find((v) => !!v.availableYields.length, args.tokenBalances)
    )
    .altLazy(() =>
      List.find((v) => !!v.availableYields.length, args.defaultTokens)
    )
    .map((val) => val.token);

const yieldTypeOrder: { [Key in YieldDto["metadata"]["type"]]: number } = {
  staking: 1,
  restaking: 2,
  "liquid-staking": 3,
  vault: 4,
  lending: 5,
};

export const getInitialYieldId = (args: {
  initQueryParams: Maybe<QueryParams>;
  yieldDtos: YieldDto[];
  tokenBalanceAmount: BigNumber;
}) => {
  const sortedYields = args.yieldDtos.sort(
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
          args.tokenBalanceAmount.isGreaterThanOrEqualTo(
            getInitMinStakeAmount(yieldDto)
          ),
        sortedYields
      )
    )
    .altLazy(() => List.head(sortedYields));
};

export const getInitMinStakeAmount = (yieldDto: YieldDto) =>
  new BigNumber(yieldDto.args.enter.args?.amount?.minimum ?? 0);

export const getInitSelectedValidators = (args: {
  initQueryParams: Maybe<QueryParams>;
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
