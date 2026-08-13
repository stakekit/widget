import { Match } from "effect";
import type { VariantProps } from "../../../../public-api/types";

type ConnectorMode =
  | "institutional"
  | "external-provider"
  | "safe"
  | "ledger-live"
  | "custom"
  | "ecosystem";

type ConnectorModeInput = {
  readonly hasCustomConnectors: boolean;
  readonly hasExternalProviders: boolean;
  readonly institutionalWallets: boolean;
  readonly isLedgerDappBrowser: boolean;
  readonly isSafe: boolean;
  readonly variant: VariantProps["variant"];
};

const resolveConnectorMode = (input: ConnectorModeInput): ConnectorMode =>
  Match.value(input).pipe(
    Match.when({ institutionalWallets: true }, () => "institutional" as const),
    Match.when({ variant: "finery" }, () => "institutional" as const),
    Match.when(
      { hasExternalProviders: true },
      () => "external-provider" as const
    ),
    Match.when({ isSafe: true }, () => "safe" as const),
    Match.when({ isLedgerDappBrowser: true }, () => "ledger-live" as const),
    Match.when({ hasCustomConnectors: true }, () => "custom" as const),
    Match.orElse(() => "ecosystem" as const)
  );

export const buildsEcosystemConnectors = (input: ConnectorModeInput): boolean =>
  Match.value(resolveConnectorMode(input)).pipe(
    Match.whenOr("institutional", "ecosystem", () => true),
    Match.orElse(() => false)
  );
