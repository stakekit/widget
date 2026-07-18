import type { Config, Connector } from "wagmi";
import type { getConnection } from "wagmi/actions";

export type WalletCoreProjection = {
  readonly connection: ReturnType<typeof getConnection>;
  readonly connectors: ReadonlyArray<Connector>;
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
      readonly projection: WalletCoreProjection;
      readonly wagmiConfig: Config;
    }
  | (WalletRuntimeUnavailableSnapshot & {
      readonly cause: unknown;
      readonly phase: "BootstrapFailed";
    })
  | {
      readonly cause: unknown;
      readonly phase: "InvariantViolated";
      readonly projection: WalletCoreProjection | null;
      readonly wagmiConfig: Config | null;
    };

export const bootstrappingWalletRuntimeSnapshot = {
  cause: null,
  phase: "Bootstrapping",
  projection: null,
  wagmiConfig: null,
} as const satisfies WalletRuntimeSnapshot;
