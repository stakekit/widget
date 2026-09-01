import { Context, type Effect, Schema } from "effect";
import type { EarnYield } from "../../domain/earn/models";
import type { YieldId } from "../../domain/identity/identifiers";
import type { EnabledWalletNetworks } from "../../domain/wallet/models";

export class WalletBootstrapSourceReadError extends Schema.TaggedError<WalletBootstrapSourceReadError>()(
  "WalletBootstrapSourceReadError",
  {
    cause: Schema.Defect(),
  }
) {}

type WalletBootstrapSourceService = {
  readonly getEnabledWalletNetworks: Effect.Effect<
    EnabledWalletNetworks,
    WalletBootstrapSourceReadError
  >;
  readonly getOpportunity: (
    yieldId: YieldId
  ) => Effect.Effect<EarnYield, WalletBootstrapSourceReadError>;
};

export class WalletBootstrapSource extends Context.Service<
  WalletBootstrapSource,
  WalletBootstrapSourceService
>()("stakekit/widget/services/wallet/WalletBootstrapSource") {}
