import type { Effect } from "effect";
import type { Chain as ViemChain } from "viem";
import type { Connector, CreateConnectorFn } from "wagmi";
import type { WalletConnectParameters } from "wagmi/connectors";

export type Chain = ViemChain & {
  readonly iconBackground?: string;
  readonly iconUrl?: string | (() => Promise<string>) | null;
};

export type WalletChainGroup = {
  readonly iconUrl: string;
  readonly id: "evm" | (string & {});
  readonly title: string;
};

export type WalletAvailability =
  /** Connects without anything injected in the page: WalletConnect, an SDK, a web popup, a hardware transport, TonConnect. */
  | Readonly<{ _tag: "Remote" }>
  /** Needs a browser extension or in-app-browser provider injected into the page. */
  | Readonly<{
      _tag: "Injected";
      /** Whether the provider is present now. Run in the background once connectors exist and again each time the picker opens; the wallet service keeps the latest settled result. */
      detect: Effect.Effect<boolean>;
      /** Desktop extension store page; omitted when none exists. */
      installUrl?: string;
    }>;

export type WalletDescriptor = {
  readonly availability: WalletAvailability;
  readonly chainGroup: WalletChainGroup;
  readonly createConnector: (details: WalletDetailsParams) => CreateConnectorFn;
  readonly desktop?: { readonly getUri?: (uri: string) => string };
  readonly iconBackground: string;
  readonly iconUrl: string | (() => Promise<string>);
  readonly id: string;
  readonly mobile?: { readonly getUri?: (uri: string) => string };
  readonly name: string;
  readonly rdns?: string;
};

/** Identifies a wallet across connector rebuilds, keying its latest detection result. */
export const walletAvailabilityKey = (
  wallet: Pick<WalletDescriptor, "chainGroup" | "id">
) => `${wallet.chainGroup.id}:${wallet.id}`;

type WalletConnectorDetails = Omit<WalletDescriptor, "createConnector"> & {
  readonly groupIndex: number;
  readonly groupName: string;
  readonly index: number;
};

export type WalletDetailsParams = {
  readonly walletDetails: WalletConnectorDetails;
};

export type CreateWalletOptions = {
  readonly appIcon?: string;
  readonly appName: string;
  readonly projectId: string;
  readonly walletConnectParameters?: StakeKitWalletConnectParameters;
};

export type CreateWalletDescriptor = (
  options: CreateWalletOptions
) => WalletDescriptor;

export type WalletList = ReadonlyArray<{
  readonly groupName: string;
  readonly wallets: ReadonlyArray<CreateWalletDescriptor>;
}>;

type StakeKitWalletConnectParameters = Omit<
  WalletConnectParameters,
  "projectId" | "showQrModal"
>;

export type ConnectorWithWalletDetails = Connector & {
  readonly walletDetails?: WalletConnectorDetails;
};

type ConnectorsForWalletsOptions = {
  readonly appDescription?: string;
  readonly appIcon?: string;
  readonly appName: string;
  readonly appUrl?: string;
  readonly projectId: string;
};

export const connectorsForWallets = (
  walletList: WalletList,
  options: ConnectorsForWalletsOptions
): CreateConnectorFn[] => {
  const metadata = {
    name: options.appName,
    description: options.appDescription ?? options.appName,
    url:
      options.appUrl ??
      (typeof window === "undefined" ? "" : window.location.origin),
    icons: options.appIcon ? [options.appIcon] : [],
  };
  const seenIds = new Set<string>();
  const connectors: CreateConnectorFn[] = [];
  let index = 0;

  for (const [groupIndex, group] of walletList.entries()) {
    for (const createWallet of group.wallets) {
      const wallet = createWallet({
        appIcon: options.appIcon,
        appName: options.appName,
        projectId: options.projectId,
        walletConnectParameters: { metadata },
      });

      if (seenIds.has(wallet.id)) continue;
      seenIds.add(wallet.id);

      const { createConnector, ...descriptor } = wallet;
      connectors.push(
        createConnector({
          walletDetails: {
            ...descriptor,
            groupIndex: groupIndex + 1,
            groupName: group.groupName,
            index,
          },
        })
      );
      index += 1;
    }
  }

  return connectors;
};
