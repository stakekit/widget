import {
  APIManager,
  YieldDto,
  getYieldYieldOpportunityQueryKey,
  useYieldYieldOpportunity,
} from "@stakekit/api-hooks";
import { useSKWallet } from "../../providers/sk-wallet";

export const useYieldOpportunity = (integrationId: string | undefined) =>
  useYieldYieldOpportunity(
    integrationId ?? "",
    { ledgerWalletAPICompatible: useSKWallet().isLedgerLive },
    { query: { enabled: !!integrationId, staleTime: 1000 * 60 * 2 } }
  );

export const getYieldOpportunityFromCache = ({
  integrationId,
  isLedgerLive,
}: {
  integrationId: string;
  isLedgerLive: boolean;
}) =>
  APIManager.getQueryClient()?.getQueryData(
    getYieldYieldOpportunityQueryKey(integrationId, {
      ledgerWalletAPICompatible: isLedgerLive,
    })
  ) as YieldDto | undefined;

export const setYieldOpportunityInCache = ({
  yieldDto,
  isLedgerLive,
}: {
  yieldDto: YieldDto;
  isLedgerLive: boolean;
}) =>
  APIManager.getQueryClient()?.setQueryData(
    getYieldYieldOpportunityQueryKey(yieldDto.id, {
      ledgerWalletAPICompatible: isLedgerLive,
    }),
    yieldDto
  );
