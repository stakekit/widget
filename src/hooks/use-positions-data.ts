import { Maybe } from "purify-ts";
import { useEnabledFilteredOpportunities } from "./api/use-filtered-opportunities";
import { useSKWallet } from "./wallet/use-sk-wallet";
import {
  YieldBalanceDto,
  YieldBalanceWithIntegrationIdRequestDto,
  YieldBalancesWithIntegrationIdDto,
  YieldOpportunityDto,
  useStakeGetMultipleIntegrationBalances,
} from "@stakekit/api-hooks";
import { createSelector } from "reselect";
import { SKWallet } from "../domain/types";

export const usePositionsData = () => {
  const filteredOpportunities = useEnabledFilteredOpportunities();

  const { address, additionalAddresses } = useSKWallet();

  const yieldBalanceWithIntegrationIdRequestDto = Maybe.fromNullable(
    filteredOpportunities.data
  )
    .chain((opportunities) =>
      Maybe.fromNullable(address).map((addr) => ({ opportunities, addr }))
    )
    .map(({ addr, opportunities }) =>
      yieldBalanceDtoSelector({ opportunities, additionalAddresses, addr })
    )
    .orDefault([]);

  const stakeGetMultipleIntegrationBalances =
    useStakeGetMultipleIntegrationBalances(
      yieldBalanceWithIntegrationIdRequestDto,
      { query: { enabled: !!yieldBalanceWithIntegrationIdRequestDto.length } }
    );

  const positionsData = Maybe.fromNullable(
    stakeGetMultipleIntegrationBalances.data
  )
    .chain((balancesData) =>
      Maybe.fromNullable(filteredOpportunities.data)
        .map(opportunitiesMapSelector)
        .map((val) => ({ balancesData, opportunitiesMap: val }))
    )
    .map(({ balancesData, opportunitiesMap }) =>
      positionsDataSelector({ balancesData, opportunitiesMap })
    )
    .orDefault(new Map());

  return {
    positionsData,
    isLoading:
      stakeGetMultipleIntegrationBalances.isInitialLoading ||
      filteredOpportunities.isInitialLoading,
  };
};

type YieldBalanceDtoSelectorData = {
  addr: string;
  additionalAddresses: SKWallet["additionalAddresses"];
  opportunities: YieldOpportunityDto[];
};

const yieldBalanceDtoSelector = createSelector(
  (data: YieldBalanceDtoSelectorData) => data.addr,
  (data: YieldBalanceDtoSelectorData) => data.opportunities,
  (data: YieldBalanceDtoSelectorData) => data.additionalAddresses,
  (addr, opportunities, additionalAddresses) =>
    opportunities.map(
      (int): YieldBalanceWithIntegrationIdRequestDto => ({
        addresses: {
          address: addr,
          additionalAddresses: additionalAddresses ?? undefined,
        },
        integrationId: int.id,
      })
    )
);

const opportunitiesMapSelector = createSelector(
  (opportunities: YieldOpportunityDto[]) => opportunities,
  (opportunities) => new Map(opportunities.map((val) => [val.id, val]))
);

type positionsDataSelectorData = {
  balancesData: YieldBalancesWithIntegrationIdDto[];
  opportunitiesMap: ReturnType<typeof opportunitiesMapSelector>;
};

type ValidatorAddress = NonNullable<YieldBalanceDto["validatorAddress"]>;

const positionsDataSelector = createSelector(
  (data: positionsDataSelectorData) => data.balancesData,
  (data: positionsDataSelectorData) => data.opportunitiesMap,
  (balancesData, opportunitiesMap) =>
    balancesData.reduce(
      (acc, val) => {
        acc.set(val.integrationId, {
          integrationData: opportunitiesMap.get(val.integrationId)!,
          balanceData: val.balances.reduce(
            (acc, b) => {
              if (b.validatorAddress) {
                if (!acc[b.validatorAddress]) acc[b.validatorAddress] = [];
                acc[b.validatorAddress].push(b);
              } else {
                if (!acc["default"]) acc["default"] = [];
                acc["default"].push(b);
              }
              return acc;
            },
            {} as {
              default: YieldBalanceDto[];
            } & Record<ValidatorAddress, YieldBalanceDto[]>
          ),
        });

        return acc;
      },
      new Map<
        YieldBalancesWithIntegrationIdDto["integrationId"],
        {
          balanceData: {
            default: YieldBalanceDto[];
          } & Record<ValidatorAddress, YieldBalanceDto[]>;
          integrationData: YieldOpportunityDto;
        }
      >()
    )
);
