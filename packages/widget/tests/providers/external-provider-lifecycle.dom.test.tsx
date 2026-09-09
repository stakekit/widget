import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { HttpResponse, http } from "msw";
import {
  type act,
  Component,
  type PropsWithChildren,
  StrictMode,
  useEffect,
} from "react";
import { avalanche, base, mainnet, optimism } from "viem/chains";
import {
  type Config,
  type Connector,
  type UseConnectionReturnType,
  useAccount,
} from "wagmi";
import { SKAtomRegistryProvider } from "../../src/app/composition/providers/atom-runtime";
import { ThirdPartyQueryClientProvider } from "../../src/app/composition/providers/query-client";
import { applicationRoutes } from "../../src/app/routes/application-routes";
import { WagmiConfigProvider } from "../../src/features/wallet/composition";
import {
  useSKWallet,
  useWalletConfig,
  walletScopeAtom,
  walletStateResultAtom,
} from "../../src/features/wallet/index";
import type { SKExternalProviders } from "../../src/public-api/types";
import type { NormalizedWalletState } from "../../src/services/wallet/wallet-state";
import { yieldApiRoute } from "../mocks/api-routes";
import { describe, expect, it, vi } from "../utils/test-extend.dom";
import { renderHook } from "../utils/test-utils.dom";

const firstAddress = "0x0000000000000000000000000000000000000001";
const secondAddress = "0x0000000000000000000000000000000000000002";
const thirdAddress = "0x0000000000000000000000000000000000000003";

const externalProvider = (
  currentAddress: string,
  currentChain: NonNullable<SKExternalProviders["currentChain"]>,
  supportedChainIds: SKExternalProviders["supportedChainIds"] = [currentChain]
): SKExternalProviders => ({
  currentAddress,
  currentChain,
  supportedChainIds,
  type: "generic",
  provider: {
    sendTransaction: async () => "transaction-hash",
    signMessage: async () => "signature",
    switchChain: async () => {},
  },
});

const enabledNetworks = http.get(yieldApiRoute("/v1/networks"), () =>
  HttpResponse.json([
    { id: "ethereum" },
    { id: "optimism" },
    { id: "avalanche-c" },
  ])
);

type ConnectedIdentity = {
  readonly address: string | undefined;
  readonly chainId: number | undefined;
};

type RuntimeResult = {
  readonly config: AsyncResult.AsyncResult<Config, unknown>;
  readonly wallet: AsyncResult.AsyncResult<NormalizedWalletState, unknown>;
};

const RuntimeResultProbe = ({
  onResult,
}: {
  readonly onResult: (result: RuntimeResult) => void;
}) => {
  const config = useWalletConfig();
  const wallet = useAtomValue(walletStateResultAtom);
  useEffect(() => onResult({ config, wallet }), [config, onResult, wallet]);
  return null;
};

class WalletFailureBoundary extends Component<
  PropsWithChildren<{ readonly onError: (error: Error) => void }>,
  { readonly failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  override render() {
    return this.state.failed ? (
      <output data-testid="wallet-runtime-error">Wallet unavailable</output>
    ) : (
      this.props.children
    );
  }
}

const mountWallet = async (
  initialProvider: SKExternalProviders,
  strictMode = false
) => {
  let externalProviders = initialProvider;
  const connectedIdentities: ConnectedIdentity[] = [];
  const errors: Error[] = [];
  const runtimeResults: RuntimeResult[] = [];
  const recordError = (error: Error) => {
    errors.push(error);
  };
  const recordRuntimeResult = (result: RuntimeResult) => {
    runtimeResults.push(result);
  };
  const hook = await renderHook(
    () => {
      const wallet = useSKWallet();
      const account = useAccount();
      const config = useWalletConfig();
      const scope = useAtomValue(walletScopeAtom);
      useEffect(() => {
        if (wallet?.status === "connected") {
          connectedIdentities.push({
            address: wallet.address,
            chainId: wallet.chain?.id,
          });
        }
      }, [wallet]);
      return { account, config, scope, wallet };
    },
    {
      wrapper: ({ children }) => {
        const runtime = (
          <ThirdPartyQueryClientProvider>
            <SKAtomRegistryProvider
              routes={applicationRoutes}
              hostConfiguration={{
                apiKey: import.meta.env.VITE_API_KEY,
                borrowEnabled: false,
                externalProviders,
                variant: "default",
              }}
            >
              <RuntimeResultProbe onResult={recordRuntimeResult} />
              <WalletFailureBoundary onError={recordError}>
                <WagmiConfigProvider>
                  <output data-testid="wallet-runtime-ready" />
                  {children}
                </WagmiConfigProvider>
              </WalletFailureBoundary>
            </SKAtomRegistryProvider>
          </ThirdPartyQueryClientProvider>
        );
        return strictMode ? <StrictMode>{runtime}</StrictMode> : runtime;
      },
    }
  );

  return {
    ...hook,
    connectedIdentities,
    errors,
    get runtimeResult() {
      const latest = runtimeResults.at(-1);
      if (!latest) throw new Error("Expected the wallet runtime result");
      return latest;
    },
    updateProvider: async (next: SKExternalProviders) => {
      externalProviders = next;
      await hook.rerender(undefined);
    },
  };
};

type MountedWallet = {
  readonly act: typeof act;
  readonly result: {
    readonly current: {
      readonly account: UseConnectionReturnType;
      readonly config: AsyncResult.AsyncResult<Config, unknown>;
      readonly wallet: NormalizedWalletState | null;
    };
  };
};

const waitForIdentity = (
  mounted: MountedWallet,
  address: string,
  chainId: number
) =>
  mounted.act(async () => {
    await expect
      .poll(() => ({
        account: {
          address: mounted.result.current.account.address,
          chainId: mounted.result.current.account.chainId,
          status: mounted.result.current.account.status,
        },
        wallet: {
          address: mounted.result.current.wallet?.address,
          chainId: mounted.result.current.wallet?.chain?.id,
          status: mounted.result.current.wallet?.status,
        },
      }))
      .toEqual({
        account: { address, chainId, status: "connected" },
        wallet: { address, chainId, status: "connected" },
      });
  });

const waitForDisconnected = (mounted: MountedWallet) =>
  mounted.act(async () => {
    await expect
      .poll(() => ({
        accountAddress: mounted.result.current.account.address,
        accountStatus: mounted.result.current.account.status,
        walletAddress: mounted.result.current.wallet?.address,
        walletStatus: mounted.result.current.wallet?.status,
      }))
      .toEqual({
        accountAddress: undefined,
        accountStatus: "disconnected",
        walletAddress: null,
        walletStatus: "disconnected",
      });
  });

const getConnector = async (mounted: MountedWallet) => {
  await mounted.act(async () => {
    await expect
      .poll(() => AsyncResult.isSuccess(mounted.result.current.config))
      .toBe(true);
  });
  const config = AsyncResult.getOrThrow(mounted.result.current.config);
  const connector = config.connectors.find(
    (candidate) => candidate.id === "externalProviderConnector"
  );
  if (!connector)
    throw new Error("Expected the real external provider connector");
  return connector;
};

const emitObsoleteIdentity = (connector: Connector) => {
  connector.onAccountsChanged([thirdAddress]);
  connector.onChainChanged(avalanche.id.toString());
};

describe("external provider runtime generations", () => {
  it("settles an initially empty host address as disconnected", async ({
    worker,
  }) => {
    worker.use(enabledNetworks);
    const mounted = await mountWallet(externalProvider("", mainnet.id));

    await waitForDisconnected(mounted);
    expect(mounted.connectedIdentities).toEqual([]);
  });

  it("uses the new identity and topology after a sequential mount", async ({
    worker,
  }) => {
    worker.use(enabledNetworks);
    const first = await mountWallet(externalProvider(firstAddress, mainnet.id));
    await waitForIdentity(first, firstAddress, mainnet.id);
    const oldConnector = await getConnector(first);
    first.unmount();

    const second = await mountWallet(
      externalProvider(secondAddress, optimism.id)
    );
    await waitForIdentity(second, secondAddress, optimism.id);
    await second.act(async () => emitObsoleteIdentity(oldConnector));
    await waitForIdentity(second, secondAddress, optimism.id);
    expect(
      second.connectedIdentities.every(
        (identity) =>
          identity.address === secondAddress && identity.chainId === optimism.id
      )
    ).toBe(true);
  });

  it("ignores an old connection that completes after a new mount", async ({
    worker,
  }) => {
    worker.use(enabledNetworks);
    const first = await mountWallet(externalProvider(firstAddress, mainnet.id));
    await waitForIdentity(first, firstAddress, mainnet.id);
    await first.updateProvider(externalProvider("", mainnet.id));
    await waitForDisconnected(first);
    const oldConnector = await getConnector(first);
    const connect = oldConnector.connect.bind(oldConnector);
    const release = Promise.withResolvers<void>();
    const completed = Promise.withResolvers<void>();
    // Keep the real connector result and delay only its delivery to Wagmi.
    const delayedConnect = vi
      .spyOn(oldConnector, "connect")
      .mockImplementation(async (parameters) => {
        const result = await connect(parameters);
        await release.promise;
        completed.resolve();
        return result;
      });

    try {
      await first.updateProvider(externalProvider(firstAddress, mainnet.id));
      await first.act(async () => {
        await expect
          .poll(() => first.result.current.wallet?.status)
          .toBe("connecting");
      });
      first.unmount();

      const second = await mountWallet(
        externalProvider(secondAddress, optimism.id)
      );
      await waitForIdentity(second, secondAddress, optimism.id);
      await second.act(async () => {
        release.resolve();
        await completed.promise;
      });
      await second.act(async () => emitObsoleteIdentity(oldConnector));
      await waitForIdentity(second, secondAddress, optimism.id);
      expect(
        second.connectedIdentities.every(
          (identity) =>
            identity.address === secondAddress &&
            identity.chainId === optimism.id
        )
      ).toBe(true);
    } finally {
      release.resolve();
      delayedConnect.mockRestore();
    }
  });

  it("clears the connected identity and restores the new host address and chain", async ({
    worker,
  }) => {
    worker.use(enabledNetworks);
    const mounted = await mountWallet(
      externalProvider(firstAddress, mainnet.id, [mainnet.id, optimism.id])
    );
    await waitForIdentity(mounted, firstAddress, mainnet.id);

    await mounted.updateProvider(
      externalProvider("", mainnet.id, [mainnet.id, optimism.id])
    );
    await waitForDisconnected(mounted);

    await mounted.updateProvider(
      externalProvider(secondAddress, optimism.id, [mainnet.id, optimism.id])
    );
    await waitForIdentity(mounted, secondAddress, optimism.id);
  });

  it("keeps an excluded host chain unsupported without reconnecting and restores it when allowed", async ({
    worker,
  }) => {
    worker.use(enabledNetworks);
    const mounted = await mountWallet(
      externalProvider(firstAddress, mainnet.id, [mainnet.id, optimism.id])
    );
    await waitForIdentity(mounted, firstAddress, mainnet.id);
    const connector = await getConnector(mounted);
    const connect = vi.spyOn(connector, "connect");

    try {
      await mounted.updateProvider(
        externalProvider(firstAddress, mainnet.id, [optimism.id])
      );
      await mounted.act(async () => {
        await expect
          .poll(() => ({
            account: {
              address: mounted.result.current.account.address,
              chainId: mounted.result.current.account.chainId,
              status: mounted.result.current.account.status,
            },
            wallet: {
              address: mounted.result.current.wallet?.address,
              chainId: mounted.result.current.wallet?.chain?.id,
              network: mounted.result.current.wallet?.network,
              status: mounted.result.current.wallet?.status,
            },
          }))
          .toEqual({
            account: {
              address: firstAddress,
              chainId: mainnet.id,
              status: "connected",
            },
            wallet: {
              address: firstAddress,
              chainId: mainnet.id,
              network: null,
              status: "unsupported",
            },
          });
      });
      mounted.connectedIdentities.length = 0;

      await mounted.act(
        () => new Promise<void>((resolve) => setTimeout(resolve, 100))
      );
      expect(mounted.result.current.wallet?.status).toBe("unsupported");
      expect(mounted.result.current.scope).toBeNull();
      expect(mounted.connectedIdentities).toEqual([]);
      expect(connect).not.toHaveBeenCalled();

      await mounted.updateProvider(
        externalProvider(firstAddress, mainnet.id, [mainnet.id, optimism.id])
      );
      await waitForIdentity(mounted, firstAddress, mainnet.id);
    } finally {
      connect.mockRestore();
    }
  });

  for (const { name, supportedChainIds } of [
    { name: "an empty supported chain list", supportedChainIds: [] },
    {
      name: "a supported chain list outside the configured topology",
      supportedChainIds: [base.id],
    },
  ] satisfies {
    name: string;
    supportedChainIds: SKExternalProviders["supportedChainIds"];
  }[]) {
    it(`fails bootstrap for ${name}`, async ({ worker }) => {
      worker.use(enabledNetworks);
      const mounted = await mountWallet(
        externalProvider(firstAddress, mainnet.id, supportedChainIds)
      );

      await mounted.act(async () => {
        await expect
          .poll(() => AsyncResult.isFailure(mounted.runtimeResult.config))
          .toBe(true);
      });
      expect(
        Option.isNone(AsyncResult.value(mounted.runtimeResult.config))
      ).toBe(true);
      expect(mounted.connectedIdentities).toEqual([]);
      expect(
        document.querySelector('[data-testid="wallet-runtime-error"]')
      ).not.toBeNull();
      expect(
        document.querySelector('[data-testid="wallet-runtime-ready"]')
      ).toBeNull();
    });

    it(`fails the live wallet and removes its usable view for ${name}`, async ({
      worker,
    }) => {
      worker.use(enabledNetworks);
      const mounted = await mountWallet(
        externalProvider(firstAddress, mainnet.id, [mainnet.id, optimism.id])
      );
      await waitForIdentity(mounted, firstAddress, mainnet.id);
      expect(
        document.querySelector('[data-testid="wallet-runtime-ready"]')
      ).not.toBeNull();

      await mounted.updateProvider(
        externalProvider(firstAddress, mainnet.id, supportedChainIds)
      );
      await mounted.act(async () => {
        await expect
          .poll(() =>
            Option.getOrNull(AsyncResult.error(mounted.runtimeResult.wallet))
          )
          .toMatchObject({
            _tag: "WalletRuntimeInvariantError",
            reason: "external-provider-no-supported-chains",
          });
        await expect
          .poll(() => mounted.errors)
          .toContainEqual(
            expect.objectContaining({
              _tag: "WalletRuntimeInvariantError",
              reason: "external-provider-no-supported-chains",
            })
          );
      });
      expect(
        document.querySelector('[data-testid="wallet-runtime-error"]')
      ).not.toBeNull();
      expect(
        document.querySelector('[data-testid="wallet-runtime-ready"]')
      ).toBeNull();
    });
  }

  it("uses every configured chain when supportedChainIds is omitted", async ({
    worker,
  }) => {
    worker.use(enabledNetworks);
    const mounted = await mountWallet({
      ...externalProvider(firstAddress, mainnet.id),
      supportedChainIds: undefined,
    });
    await waitForIdentity(mounted, firstAddress, mainnet.id);

    await mounted.updateProvider({
      ...externalProvider(secondAddress, optimism.id),
      supportedChainIds: undefined,
    });
    await waitForIdentity(mounted, secondAddress, optimism.id);
  });

  it("connects the restored identity after an earlier pending connection fails", async ({
    worker,
  }) => {
    worker.use(enabledNetworks);
    const mounted = await mountWallet(
      externalProvider(firstAddress, mainnet.id, [mainnet.id, optimism.id])
    );
    await waitForIdentity(mounted, firstAddress, mainnet.id);
    await mounted.updateProvider(
      externalProvider("", mainnet.id, [mainnet.id, optimism.id])
    );
    await waitForDisconnected(mounted);
    mounted.connectedIdentities.length = 0;
    const connector = await getConnector(mounted);
    const connect = connector.connect.bind(connector);
    const release = Promise.withResolvers<void>();
    const failed = Promise.withResolvers<void>();
    const pendingConnect = vi
      .spyOn(connector, "connect")
      .mockImplementationOnce(async (parameters) => {
        await connect(parameters);
        await release.promise;
        failed.resolve();
        throw new Error("The earlier external-provider connection failed");
      });

    try {
      await mounted.updateProvider(
        externalProvider(firstAddress, mainnet.id, [mainnet.id, optimism.id])
      );
      await mounted.act(async () => {
        await expect
          .poll(() => mounted.result.current.wallet?.status)
          .toBe("connecting");
      });
      await mounted.updateProvider(
        externalProvider("", mainnet.id, [mainnet.id, optimism.id])
      );
      await mounted.updateProvider(
        externalProvider(secondAddress, optimism.id, [mainnet.id, optimism.id])
      );
      await mounted.act(async () => {
        release.resolve();
        await failed.promise;
      });

      await waitForIdentity(mounted, secondAddress, optimism.id);
      expect(
        mounted.connectedIdentities.every(
          (identity) => identity.address === secondAddress
        )
      ).toBe(true);
    } finally {
      release.resolve();
      pendingConnect.mockRestore();
    }
  });

  it("keeps repeated generations isolated from every retired connector", async ({
    worker,
  }) => {
    worker.use(enabledNetworks);
    const retiredConnectors: Connector[] = [];
    for (const provider of [
      externalProvider(firstAddress, mainnet.id),
      externalProvider(secondAddress, optimism.id),
      externalProvider(thirdAddress, avalanche.id),
      externalProvider(firstAddress, mainnet.id),
    ]) {
      const mounted = await mountWallet(provider);
      const chainId = provider.currentChain!;
      await waitForIdentity(mounted, provider.currentAddress, chainId);
      await mounted.act(async () => {
        for (const connector of retiredConnectors) {
          connector.onAccountsChanged([secondAddress]);
          connector.onChainChanged(optimism.id.toString());
          connector.onDisconnect();
        }
      });
      await waitForIdentity(mounted, provider.currentAddress, chainId);
      expect(
        mounted.connectedIdentities.every(
          (identity) =>
            identity.address === provider.currentAddress &&
            identity.chainId === chainId
        )
      ).toBe(true);
      retiredConnectors.push(await getConnector(mounted));
      mounted.unmount();
    }
  });

  it("survives StrictMode replay, live identity changes, and a fresh mount", async ({
    worker,
  }) => {
    worker.use(enabledNetworks);
    const first = await mountWallet(
      externalProvider(firstAddress, mainnet.id, [mainnet.id, optimism.id]),
      true
    );
    await waitForIdentity(first, firstAddress, mainnet.id);
    const oldConnector = await getConnector(first);
    await first.updateProvider(
      externalProvider(secondAddress, optimism.id, [mainnet.id, optimism.id])
    );
    await waitForIdentity(first, secondAddress, optimism.id);
    first.unmount();

    const second = await mountWallet(
      externalProvider(thirdAddress, avalanche.id),
      true
    );
    await waitForIdentity(second, thirdAddress, avalanche.id);
    await second.act(async () => {
      oldConnector.onAccountsChanged([firstAddress]);
      oldConnector.onChainChanged(mainnet.id.toString());
      oldConnector.onDisconnect();
    });
    await waitForIdentity(second, thirdAddress, avalanche.id);
    expect(
      second.connectedIdentities.every(
        (identity) =>
          identity.address === thirdAddress && identity.chainId === avalanche.id
      )
    ).toBe(true);
  });
});
