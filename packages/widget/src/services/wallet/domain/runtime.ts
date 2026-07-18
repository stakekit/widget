import type { Config, Connector } from "wagmi";
import type { getConnection } from "wagmi/actions";
import type { LedgerConnectorState, NormalizedWalletState } from "./state";

export type WalletCoreProjection = {
  readonly connection: ReturnType<typeof getConnection>;
  readonly connectors: ReadonlyArray<Connector>;
};

export type WalletProjection = WalletCoreProjection & {
  readonly ledgerState: LedgerConnectorState;
  readonly state: NormalizedWalletState;
};

type WalletRuntimeUnavailableSnapshot = {
  readonly projection: null;
  readonly wagmiConfig: null;
};

export type WalletRuntimeSnapshot =
  | (WalletRuntimeUnavailableSnapshot & {
      readonly cause: null;
      readonly phase: "Bootstrapping";
    })
  | {
      readonly cause: null;
      readonly phase: "Ready";
      readonly projection: WalletProjection;
      readonly wagmiConfig: Config;
    }
  | (WalletRuntimeUnavailableSnapshot & {
      readonly cause: unknown;
      readonly phase: "BootstrapFailed";
    })
  | {
      readonly cause: unknown;
      readonly phase: "InvariantViolated";
      readonly projection: WalletProjection | null;
      readonly wagmiConfig: Config | null;
    };

export const bootstrappingWalletRuntimeSnapshot = {
  cause: null,
  phase: "Bootstrapping",
  projection: null,
  wagmiConfig: null,
} as const satisfies WalletRuntimeSnapshot;
