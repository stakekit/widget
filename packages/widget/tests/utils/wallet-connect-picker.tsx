import { useAtomSet } from "@effect/atom-react";
import { Effect, Latch, Stream } from "effect";
import { HttpResponse, http, type RequestHandler } from "msw";
import { I18nextProvider } from "react-i18next";
import { type Address, type Chain, UserRejectedRequestError } from "viem";
import { vi } from "vitest";
import type { CreateConnectorFn } from "wagmi";
import { mock } from "wagmi/connectors";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { walletConnectorSourceRuntime } from "../../src/app/runtime/wallet-connector-source-runtime";
import { WagmiConfigProvider } from "../../src/features/wallet/composition";
import { setWalletConnectModalOpenAtom } from "../../src/features/wallet/state/wallet-modal";
import { WalletModalsProvider } from "../../src/features/wallet/views";
import type { SKAppProps } from "../../src/public-api/react-types";
import {
  composeWidgetTranslationResources,
  createWidgetI18nInstance,
  reconcileWidgetI18n,
} from "../../src/services/translation/widget-translation";
import { evmChainGroup } from "../../src/services/wallet/evm-chain-group";
import {
  WalletConnectorSource,
  type WalletListFactory,
} from "../../src/services/wallet/wallet-connector-source";
import type { WalletList } from "../../src/services/wallet/wallet-descriptors";
import { WalletNotAvailableError } from "../../src/services/wallet/wallet-errors";
import { WalletModal } from "../../src/services/wallet/wallet-modal";
import { yieldApiRoute } from "../mocks/api-routes";
import { TestAtomRuntimeProvider } from "./atom-runtime-provider";
import { getTestWidgetConfig } from "./widget-config";

export type PickerWallet = Readonly<{
  id: string;
  /** Wallet family publishing its own chains; omitted for wagmi EVM wallets. */
  family?: Readonly<{ id: string; chains: ReadonlyArray<Chain> }>;
  /** Needs an injected provider (browser extension); omitted for remote wallets. */
  injected?: Readonly<{
    installUrl?: string;
    /** The provider probe waits until the test settles it, as a slow SDK check does. */
    unsettled?: true;
  }>;
}>;

export type PickerWalletGroup = Readonly<{
  groupName: string;
  wallets: ReadonlyArray<PickerWallet>;
}>;

export type ConnectorCall = Readonly<{
  walletId: string;
  chainId: number | undefined;
}>;

/** An injected wallet's provider probe: held while its gate is closed. */
type Probe = { readonly gate: Latch.Latch; settled: number };

const account: Address = "0x0000000000000000000000000000000000000001";

/**
 * A fake wallet connector. Connection requests are recorded and held open, as
 * a wallet awaiting approval would, until the test declines them. An injected
 * wallet is present while its id is in `extensions`, as its probe reports once
 * let through; connecting without it fails as a family connector does.
 */
const fakeWallet =
  (
    wallet: PickerWallet,
    calls: Array<ConnectorCall>,
    pending: Array<() => void>,
    extensions: Set<string>,
    probe: Probe
  ): WalletList[number]["wallets"][number] =>
  () => ({
    availability: wallet.injected
      ? {
          _tag: "Injected",
          detect: probe.gate.await.pipe(
            Effect.andThen(
              Effect.sync(() => {
                probe.settled += 1;
                return extensions.has(wallet.id);
              })
            )
          ),
          installUrl: wallet.injected.installUrl,
        }
      : { _tag: "Remote" },
    chainGroup: wallet.family
      ? { id: wallet.family.id, title: wallet.family.id, iconUrl: "" }
      : evmChainGroup,
    iconBackground: "#fff",
    iconUrl: "",
    id: wallet.id,
    name: wallet.id,
    createConnector:
      ({ walletDetails }): CreateConnectorFn =>
      (config) => ({
        ...mock({ accounts: [account] })(config),
        id: wallet.id,
        name: wallet.id,
        walletDetails,
        ...(wallet.family && {
          $filteredChains: Stream.succeed([...wallet.family.chains]),
        }),
        connect: (parameters) => {
          if (wallet.injected && !extensions.has(wallet.id)) {
            return Promise.reject(
              new WalletNotAvailableError({ walletId: wallet.id })
            );
          }
          calls.push({ walletId: wallet.id, chainId: parameters?.chainId });
          const { promise, reject } = Promise.withResolvers<never>();
          pending.push(() =>
            reject(new UserRejectedRequestError(new Error("declined")))
          );
          return promise;
        },
      }),
  });

const setPresentationOpenAtom = appRuntime.fn((open: boolean) =>
  WalletModal.use((modal) => modal.presentationOpen.set(open))
);

/** Opens the picker as the connect button does and stands in for AppKit. */
const PickerControls = () => {
  const openPicker = useAtomSet(setWalletConnectModalOpenAtom);
  const setPresentationOpen = useAtomSet(setPresentationOpenAtom);
  return (
    <>
      <button type="button" onClick={() => openPicker(true)}>
        Open wallets
      </button>
      <button type="button" onClick={() => setPresentationOpen(true)}>
        Present AppKit
      </button>
      <button type="button" onClick={() => setPresentationOpen(false)}>
        Close AppKit
      </button>
    </>
  );
};

/** Makes the browser look like a phone: mobile user agent and touch events. */
const emulateMobileDevice = Effect.acquireRelease(
  Effect.sync(() =>
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("iPhone")
  ),
  (userAgent) => Effect.sync(() => userAgent.mockRestore())
);

/** Makes the browser look like a desktop: no touch events. */
const emulateDesktopDevice = Effect.acquireRelease(
  Effect.sync(() => {
    const createEvent = document.createEvent.bind(document);
    return vi
      .spyOn(document, "createEvent")
      .mockImplementation((eventInterface: string) => {
        if (eventInterface === "TouchEvent") {
          throw new DOMException("Not supported", "NotSupportedError");
        }
        return createEvent(eventInterface);
      });
  }),
  (createEvent) => Effect.sync(() => createEvent.mockRestore())
);

/**
 * Builds the connect picker on the real wallet runtime. Only the wallet
 * connectors, the injected providers they detect, browser-extension
 * announcements (EIP-6963), the device and the enabled-networks API response
 * are fake.
 */
export const makeWalletConnectPicker = Effect.fn("makeWalletConnectPicker")(
  function* (options: {
    /** The test's MSW server (jsdom) or worker (Chromium). */
    readonly api: { readonly use: (...handlers: RequestHandler[]) => void };
    readonly groups: ReadonlyArray<PickerWalletGroup>;
    readonly announcedWallets?: ReadonlyArray<string>;
    readonly networks?: ReadonlyArray<string>;
    readonly initialChain?: SKAppProps["initialChain"];
    /** Ids of injected wallets whose provider is present; defaults to none. */
    readonly extensions?: ReadonlyArray<string>;
    readonly device?: "desktop" | "mobile";
  }) {
    yield* options.device === "mobile"
      ? emulateMobileDevice
      : emulateDesktopDevice;
    const extensions = new Set(options.extensions);
    const probes = new Map(
      options.groups.flatMap(({ wallets }) =>
        wallets.map(
          (wallet) =>
            [
              wallet.id,
              {
                gate: Latch.makeUnsafe(!wallet.injected?.unsettled),
                settled: 0,
              },
            ] as const
        )
      )
    );
    const probe = (walletId: string) => {
      const found = probes.get(walletId);
      if (!found) throw new Error(`No wallet ${walletId} in the picker`);
      return found;
    };
    const calls: Array<ConnectorCall> = [];
    const pending: Array<() => void> = [];
    const announcedWallets = options.announcedWallets ?? [];
    const announce = () => {
      for (const name of announcedWallets) {
        window.dispatchEvent(
          new CustomEvent("eip6963:announceProvider", {
            detail: Object.freeze({
              info: {
                icon: "data:image/svg+xml,<svg/>",
                name,
                rdns: `test.${name}`,
                uuid: crypto.randomUUID(),
              },
              provider: {
                request: async () => [],
                on: () => {},
                removeListener: () => {},
              },
            }),
          })
        );
      }
    };
    yield* Effect.acquireRelease(
      Effect.sync(() =>
        window.addEventListener("eip6963:requestProvider", announce)
      ),
      () =>
        Effect.sync(() =>
          window.removeEventListener("eip6963:requestProvider", announce)
        )
    );
    options.api.use(
      http.get(yieldApiRoute("/v1/networks"), () =>
        HttpResponse.json(
          (options.networks ?? ["ethereum"]).map((id) => ({ id }))
        )
      )
    );
    const walletListFactory: WalletListFactory = () =>
      options.groups.map((group) => ({
        groupName: group.groupName,
        wallets: group.wallets.map((wallet) =>
          fakeWallet(wallet, calls, pending, extensions, probe(wallet.id))
        ),
      }));
    const i18n = createWidgetI18nInstance();
    reconcileWidgetI18n({
      i18n,
      language: "en",
      resources: composeWidgetTranslationResources({
        apiErrors: undefined,
        customTranslations: undefined,
        language: "en",
        variant: "default",
      }),
    });

    return {
      /** Connection requests that reached the wallet connectors. */
      calls: Effect.sync(() => [...calls]),
      /** Injects the wallet's provider, as installing its extension does. */
      install: (walletId: string) =>
        Effect.sync(() => {
          extensions.add(walletId);
        }),
      /** Removes the wallet's provider, as disabling its extension does. */
      uninstall: (walletId: string) =>
        Effect.sync(() => {
          extensions.delete(walletId);
        }),
      /** Lets the wallet's waiting and later probes report. */
      settle: (walletId: string) => probe(walletId).gate.open,
      /** Makes the wallet's later probes wait until settled, as a slow SDK check does. */
      hold: (walletId: string) => probe(walletId).gate.close,
      /** How many of the wallet's provider probes have reported. */
      settledProbes: (walletId: string) => probe(walletId).settled,
      /** Declines every connection request still awaiting approval. */
      declinePending: Effect.sync(() => {
        for (const decline of pending.splice(0)) decline();
      }),
      element: (
        <TestAtomRuntimeProvider
          initialValues={[
            [
              walletConnectorSourceRuntime.layer,
              WalletConnectorSource.layer(walletListFactory),
            ],
          ]}
          settings={getTestWidgetConfig({
            apiKey: "test-api-key",
            disableInjectedProviderDiscovery: announcedWallets.length === 0,
            initialChain: options.initialChain,
            variant: "default",
          })}
        >
          <I18nextProvider i18n={i18n}>
            <WagmiConfigProvider>
              <PickerControls />
              <WalletModalsProvider />
            </WagmiConfigProvider>
          </I18nextProvider>
        </TestAtomRuntimeProvider>
      ),
    } as const;
  }
);
