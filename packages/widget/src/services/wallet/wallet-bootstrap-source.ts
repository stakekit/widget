import { Context, type Effect } from "effect";
import type { EarnYield } from "../../domain/earn/models";
import type { YieldId } from "../../domain/identity/identifiers";
import type { EnabledNetworks } from "../../domain/wallet/models";

type WalletBootstrapSourceService = {
  readonly getEnabledNetworks: () => Effect.Effect<EnabledNetworks, unknown>;
  readonly getOpportunity: (
    yieldId: YieldId
  ) => Effect.Effect<typeof EarnYield.Type, unknown>;
};

export class WalletBootstrapSource extends Context.Service<
  WalletBootstrapSource,
  WalletBootstrapSourceService
>()("stakekit/widget/services/wallet/WalletBootstrapSource") {}
