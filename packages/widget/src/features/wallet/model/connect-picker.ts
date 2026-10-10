import { Effect, Option, Stream } from "effect";
import type { Connector } from "wagmi";
import { EvmChainIds } from "../../../domain/wallet/chain-ids";
import { evmChainGroup } from "../../../services/wallet/evm-chain-group";
import { isConnectorWithFilteredChains } from "../../../services/wallet/wallet-connectors";
import {
  type ConnectorWithWalletDetails,
  type WalletAvailability,
  type WalletChainGroup,
  walletAvailabilityKey,
} from "../../../services/wallet/wallet-descriptors";

type ConnectPickerWalletAction =
  | Readonly<{ _tag: "Connect" }>
  | Readonly<{ _tag: "Install"; url: string }>
  /** Its extension is still being detected; neither action is offered yet. */
  | Readonly<{ _tag: "Checking" }>;

export type ConnectPickerWallet = Readonly<{
  action: ConnectPickerWalletAction;
  connector: ConnectorWithWalletDetails;
  iconUrl: string | (() => Promise<string>) | undefined;
  id: string;
  title: string;
}>;

export type ConnectPickerGroup = Readonly<{
  /** Unique within an ecosystem; never collides with a host group name. */
  id: string;
  /** The picker's own bucket of detected injected wallets, or a catalogue group. */
  label:
    | Readonly<{ _tag: "Installed" }>
    | Readonly<{ _tag: "Catalogue"; name: string }>;
  wallets: ReadonlyArray<ConnectPickerWallet>;
}>;

export type ConnectPickerEcosystem = Readonly<{
  chainGroup: WalletChainGroup;
  groups: ReadonlyArray<ConnectPickerGroup>;
}>;

/** Where a wallet's row sits while the picker stays open. */
type Placement = "Installed" | "Catalogue";

type Candidate = Readonly<{
  chainGroup: WalletChainGroup;
  dedupeKey: string;
  detected: boolean;
  group: Readonly<{
    index: number;
    id: string;
    label: ConnectPickerGroup["label"];
  }>;
  key: string;
  placement: Placement;
  wallet: ConnectPickerWallet;
}>;

type Resolution = Readonly<{
  action: ConnectPickerWalletAction;
  detected: boolean;
}>;

/** Detected injected wallets render in this group, ahead of catalogue groups. */
const installedGroup: Candidate["group"] = {
  id: "installed",
  index: -1,
  label: { _tag: "Installed" },
};

const connectAction: ConnectPickerWalletAction = { _tag: "Connect" };

/**
 * What the picker offers for a wallet given its latest detection (`undefined`
 * until one settles), or `undefined` to hide it. Remote and detected injected
 * wallets connect. On desktop, an injected wallet with a store page keeps its
 * row while being checked and offers installation when missing. Without a
 * store page, or on mobile, a missing wallet could not be connected anyway, so
 * it is shown only once detected.
 */
const resolveWallet = (
  availability: WalletAvailability | undefined,
  detected: boolean | undefined,
  isMobile: boolean
): Resolution | undefined => {
  if (availability?._tag !== "Injected") {
    return { action: connectAction, detected: false };
  }
  if (detected) return { action: connectAction, detected: true };
  if (isMobile || availability.installUrl === undefined) return undefined;
  if (detected === undefined) {
    return { action: { _tag: "Checking" }, detected: false };
  }
  return {
    action: { _tag: "Install", url: availability.installUrl },
    detected: false,
  };
};

const toCandidate = (
  connector: ConnectorWithWalletDetails,
  key: string,
  resolution: Resolution,
  placement: Placement
): Candidate => {
  const details = connector.walletDetails;
  const chainGroup = details?.chainGroup ?? evmChainGroup;
  const walletId = details?.id ?? connector.id;
  const groupName = details?.groupName ?? "";

  return {
    chainGroup,
    dedupeKey: `${chainGroup.id}:${details?.rdns ?? walletId}`,
    detected: resolution.detected,
    group:
      placement === "Installed"
        ? installedGroup
        : {
            id: `catalogue:${groupName}`,
            index: details?.groupIndex ?? Number.MAX_SAFE_INTEGER,
            label: { _tag: "Catalogue", name: groupName },
          },
    key,
    placement,
    wallet: {
      action: resolution.action,
      connector,
      iconUrl: details?.iconUrl || connector.icon || undefined,
      id: `${chainGroup.id}-${walletId}`,
      title: details?.name ?? connector.name,
    },
  };
};

/**
 * Groups visible wallets into ecosystems. Each ecosystem lists detected
 * injected wallets first under "Installed", then the rest under their
 * catalogue groups, ordered by group index. Detected duplicates win over
 * catalogue entries. Ecosystems without visible wallets are omitted.
 */
const projectEcosystems = (
  candidates: ReadonlyArray<Candidate | undefined>
): ReadonlyArray<ConnectPickerEcosystem> => {
  const visible = candidates.filter((candidate) => candidate !== undefined);
  const preferred = new Map<string, Candidate>();

  for (const candidate of visible) {
    const current = preferred.get(candidate.dedupeKey);
    if (!current || (candidate.detected && !current.detected)) {
      preferred.set(candidate.dedupeKey, candidate);
    }
  }

  const ecosystems = new Map<
    string,
    {
      chainGroup: WalletChainGroup;
      groups: Map<
        string,
        Candidate["group"] & { wallets: ReadonlyArray<ConnectPickerWallet> }
      >;
    }
  >();

  for (const candidate of visible) {
    if (preferred.get(candidate.dedupeKey) !== candidate) continue;

    const ecosystem = ecosystems.get(candidate.chainGroup.id) ?? {
      chainGroup: candidate.chainGroup,
      groups: new Map(),
    };
    const group = ecosystem.groups.get(candidate.group.id) ?? {
      ...candidate.group,
      wallets: [],
    };
    ecosystem.groups.set(candidate.group.id, {
      ...group,
      index: Math.min(group.index, candidate.group.index),
      wallets: [...group.wallets, candidate.wallet],
    });
    ecosystems.set(candidate.chainGroup.id, ecosystem);
  }

  return Array.from(
    ecosystems.values(),
    ({ chainGroup, groups }): ConnectPickerEcosystem => ({
      chainGroup,
      groups: Array.from(groups.values())
        .toSorted((left, right) => left.index - right.index)
        .map(({ id, label, wallets }) => ({ id, label, wallets })),
    })
  );
};

/**
 * Picker ecosystems for one open session, as connectors and detection results
 * change. Rows never move while the picker stays open: a wallet's group is
 * fixed when its row first appears, so only wallets detected by then (cached
 * or already settled) are listed under Installed; one detected later connects
 * from its catalogue group until the next open. A wallet still being checked
 * keeps its row and only its action changes when the result settles.
 */
export const connectPickerEcosystems = <E>({
  availability,
  connectors,
  isMobile,
}: {
  /** Latest settled detection per injected wallet, by `walletAvailabilityKey`. */
  readonly availability: Stream.Stream<ReadonlyMap<string, boolean>>;
  readonly connectors: Stream.Stream<
    ReadonlyArray<ConnectorWithWalletDetails>,
    E
  >;
  readonly isMobile: boolean;
}): Stream.Stream<ReadonlyArray<ConnectPickerEcosystem>, E> =>
  Stream.zipLatest(connectors, availability).pipe(
    Stream.mapAccum(
      (): ReadonlyMap<string, Placement> => new Map(),
      (placements, [current, results]) => {
        const candidates = current.map((connector) => {
          const details = connector.walletDetails;
          const key = details ? walletAvailabilityKey(details) : connector.uid;
          const resolution = resolveWallet(
            details?.availability,
            results.get(key),
            isMobile
          );
          return (
            resolution &&
            toCandidate(
              connector,
              key,
              resolution,
              placements.get(key) ??
                (resolution.detected ? "Installed" : "Catalogue")
            )
          );
        });
        const shown = new Map(placements);
        for (const candidate of candidates) {
          if (candidate && !shown.has(candidate.key)) {
            shown.set(candidate.key, candidate.placement);
          }
        }
        return [shown, [projectEcosystems(candidates)]] as const;
      }
    )
  );

const evmChainIds = new Set<number>(Object.values(EvmChainIds));

/**
 * Chain to request when connecting `connector`: the host's initial chain when
 * the connector supports it, otherwise none so the wallet keeps its current
 * chain. Family connectors publish their chains; wagmi's EVM wallets support
 * the enabled EVM chains.
 */
export const connectionChainId = Effect.fn("connectionChainId")(function* ({
  connector,
  enabledChains,
  initialChain,
}: {
  readonly connector: Connector;
  readonly enabledChains: ReadonlyArray<{ readonly id: number }>;
  readonly initialChain: number | undefined;
}) {
  if (initialChain === undefined) return undefined;

  const chains: ReadonlyArray<{ readonly id: number }> =
    isConnectorWithFilteredChains(connector)
      ? Option.getOrElse(
          yield* Stream.runHead(connector.$filteredChains),
          () => []
        )
      : enabledChains.filter((chain) => evmChainIds.has(chain.id));

  return chains.some((chain) => chain.id === initialChain)
    ? initialChain
    : undefined;
});
