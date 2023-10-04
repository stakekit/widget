import { useYieldYieldOpportunity } from "@stakekit/api-hooks";
import { useSKWallet } from "../wallet/use-sk-wallet";

export const useYieldOpportunity = (integrationId: string | undefined) =>
  useYieldYieldOpportunity(
    integrationId ?? "",
    { ledgerWalletAPICompatible: useSKWallet().isLedgerLive },
    { query: { enabled: !!integrationId, staleTime: 1000 * 60 * 2 } }
  );
