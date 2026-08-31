import { RegistryProvider } from "@effect/atom-react";
import { HttpResponse, http } from "msw";
import { mainnet } from "viem/chains";
import { userEvent } from "vitest/browser";
import { createConfig, createConnector, http as wagmiHttp } from "wagmi";
import { connect, reconnect } from "wagmi/actions";
import { KycGateCard } from "../../src/features/yield-summary/ui/components/kyc-gate-card";
import type { SKAppProps } from "../../src/public-api/react-types";
import { formatAddress } from "../../src/shared/lib/general";
import { yieldApiYieldDtoFixture } from "../fixtures";
import { legacyApiRoute, yieldApiRoute } from "../mocks/api-routes";
import { mockDelay } from "../mocks/delay";
import { describe, expect, it, vi } from "../utils/test-extend";
import { render, renderApp } from "../utils/test-utils";
import { applicationRuntimeInitInitialValue } from "../utils/widget-config";
import { setup as setupStakingFlow } from "./staking-flow/setup";
import { setup as setupTrustPosition } from "./trust-incentive-apy/setup";

const account = "0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7";

const makeTestConnector = ({
  id,
  onConnect = async () => {},
}: {
  readonly id: string;
  readonly onConnect?: () => Promise<void>;
}) =>
  createConnector((config) => ({
    id,
    name: id,
    type: id,
    connect: async (parameters) => {
      await onConnect();

      return {
        accounts: parameters?.withCapabilities
          ? [{ address: account, capabilities: {} }]
          : [account],
        chainId: mainnet.id,
      } as never;
    },
    disconnect: async () => {},
    getAccounts: async () => [account],
    getChainId: async () => mainnet.id,
    getProvider: async () => ({}),
    isAuthorized: async () => true,
    onAccountsChanged: () => {},
    onChainChanged: () => {},
    onDisconnect: () => config.emitter.emit("disconnect"),
  }));

const makeBlockingReconnect = () => {
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const connector = makeTestConnector({
    id: "blocking-connector",
    onConnect: async () => {
      started.resolve();
      await release.promise;
    },
  });
  const wagmiConfig = createConfig({
    chains: [mainnet],
    connectors: [connector],
    storage: null,
    transports: { [mainnet.id]: wagmiHttp() },
  });

  return {
    release: release.resolve,
    run: () => reconnect(wagmiConfig),
    started: started.promise,
  };
};

const persistStaleWagmiConnection = async () => {
  const wagmiConfig = createConfig({
    chains: [mainnet],
    connectors: [makeTestConnector({ id: "persisted-non-external-connector" })],
    transports: { [mainnet.id]: wagmiHttp() },
  });
  const connector = wagmiConfig.connectors[0];

  if (!connector) throw new Error("Expected the test connector");

  await connect(wagmiConfig, { connector });
  await vi.waitFor(() => {
    expect(window.localStorage.getItem("wagmi.store")).not.toBeNull();
  });
};

const skProps = {
  apiKey: import.meta.env.VITE_API_KEY,
  externalProviders: {
    type: "generic",
    provider: {
      signMessage: async () => "signature",
      switchChain: async () => {},
      sendTransaction: async () => "hash",
    },
    currentAddress: account,
    currentChain: mainnet.id,
    supportedChainIds: [mainnet.id],
  },
} satisfies SKAppProps;

const mockKycStatus = ({ status }: { status: string }) => {
  let calls = 0;
  let currentStatus = status;
  let requestedAddress: string | null = null;

  const handler = http.get(
    yieldApiRoute("/v1/yields/:yieldId/kyc/status"),
    async ({ request }) => {
      await mockDelay();
      calls += 1;
      requestedAddress = new URL(request.url).searchParams.get("address");

      return HttpResponse.json({
        kycStatus: currentStatus,
        kycUrl: "https://issuer.example/verify",
      });
    }
  );

  return {
    handler,
    getCalls: () => calls,
    getRequestedAddress: () => requestedAddress,
    setStatus: (newStatus: string) => {
      currentStatus = newStatus;
    },
  };
};

const mockKycRequiredDefaultYield = () => {
  const baseYield = yieldApiYieldDtoFixture();
  const kycRequiredYield = yieldApiYieldDtoFixture({
    ...baseYield,
    mechanics: {
      ...baseYield.mechanics,
      requirements: {
        kycRequired: true,
        kyc: {
          kycMode: "oauth_redirect",
          iframeAllowed: false,
          authorizeUrl: "https://issuer.example/verify",
          eligibility: {
            defaultPolicy: "allow",
            countries: [],
            blockedCountries: [],
            blockedSubdivisions: [],
            usPersonAllowed: true,
            investorEligibility: [],
            subjectTypes: ["KYC"],
          },
        },
      },
    },
  });

  return [
    http.post(legacyApiRoute("/v1/tokens/balances/scan"), async () => {
      await mockDelay();

      return HttpResponse.json([
        {
          token: baseYield.token,
          amount: "1",
          availableYields: [baseYield.id],
        },
      ]);
    }),
    http.post(legacyApiRoute("/v1/tokens/balances"), async () => {
      await mockDelay();

      return HttpResponse.json([
        {
          token: baseYield.token,
          amount: "1",
          availableYields: [baseYield.id],
        },
      ]);
    }),
    http.get(yieldApiRoute("/v1/yields"), async () => {
      await mockDelay();

      return HttpResponse.json({
        items: [kycRequiredYield],
        total: 1,
        offset: 0,
        limit: 1,
      });
    }),
    http.get(yieldApiRoute(`/v1/yields/${baseYield.id}`), async () => {
      await mockDelay();

      return HttpResponse.json(kycRequiredYield);
    }),
  ];
};

describe("RWA KYC flow", () => {
  it("ignores a persisted non-external connection while another reconnect is running", async ({
    worker,
  }) => {
    const reconnectBlocker = makeBlockingReconnect();
    window.localStorage.removeItem("wagmi.store");
    await persistStaleWagmiConnection();
    const blockingReconnect = reconnectBlocker.run();
    await reconnectBlocker.started;

    try {
      const kycStatus = mockKycStatus({ status: "not_started" });

      worker.use(...mockKycRequiredDefaultYield(), kycStatus.handler);

      const app = await renderApp({ skProps });

      try {
        await expect
          .element(app.getByTestId("kyc-gate-card-start_kyc"), {
            timeout: 5_000,
          })
          .toBeInTheDocument();
        await expect.poll(kycStatus.getRequestedAddress).toBe(account);
      } finally {
        await app.unmount();
      }
    } finally {
      reconnectBlocker.release();
      await blockingReconnect;
      window.localStorage.removeItem("wagmi.store");
    }
  });

  it("shows not started verification card and fetches wallet status", async ({
    worker,
  }) => {
    const kycStatus = mockKycStatus({ status: "not_started" });

    worker.use(...mockKycRequiredDefaultYield(), kycStatus.handler);

    const app = await renderApp({ skProps });

    await expect
      .element(app.getByTestId("kyc-gate-card-start_kyc"))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("Identity verification required"))
      .toBeInTheDocument();
    await expect.poll(kycStatus.getRequestedAddress).toBe(account);

    await app.unmount();
  });

  it("opens iframe modal for iframe-allowed verification and refreshes status on close", async () => {
    const onCheckStatus = vi.fn();
    const app = await render(
      <RegistryProvider initialValues={[applicationRuntimeInitInitialValue()]}>
        <KycGateCard
          gate={{
            state: "start_kyc",
            kycUrl: "https://issuer.example/verify",
            iframeAllowed: true,
          }}
          onCheckStatus={onCheckStatus}
          providerName="Superstate"
        />
      </RegistryProvider>
    );

    await expect
      .element(app.getByTestId("kyc-gate-card-start_kyc"))
      .toBeInTheDocument();

    await userEvent.click(app.getByTestId("kyc-gate-verify"));

    await expect
      .element(app.getByTestId("kyc-verification-modal"))
      .toBeInTheDocument();
    await expect
      .element(app.getByTestId("kyc-verification-iframe"))
      .toHaveAttribute("src", "https://issuer.example/verify");

    await userEvent.click(app.getByTestId("kyc-verification-close"));

    expect(onCheckStatus).toHaveBeenCalledOnce();
    await expect
      .poll(() => app.getByTestId(/^kyc-gate-card/).elements().length)
      .toBe(1);

    await app.unmount();
  });

  it("opens verification externally when iframe is not allowed", async ({
    worker,
  }) => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const kycStatus = mockKycStatus({ status: "not_started" });

    worker.use(...mockKycRequiredDefaultYield(), kycStatus.handler);

    const app = await renderApp({ skProps });

    await expect
      .element(app.getByTestId("kyc-gate-card-start_kyc"))
      .toBeInTheDocument();

    await userEvent.click(app.getByTestId("kyc-gate-verify"));

    expect(openSpy).toHaveBeenCalledWith(
      "https://issuer.example/verify",
      "_blank",
      "noopener,noreferrer"
    );
    await expect
      .poll(() => app.getByTestId("kyc-verification-modal").elements().length)
      .toBe(0);

    openSpy.mockRestore();
    await app.unmount();
  });

  it("refreshes pending status with Check status", async ({ worker }) => {
    const kycStatus = mockKycStatus({ status: "pending" });

    worker.use(...mockKycRequiredDefaultYield(), kycStatus.handler);

    const app = await renderApp({ skProps });

    await expect
      .element(app.getByTestId("kyc-gate-card-pending"))
      .toBeInTheDocument();

    kycStatus.setStatus("approved");
    await userEvent.click(app.getByTestId("kyc-gate-check-status"));

    await expect
      .poll(() => app.getByTestId(/^kyc-gate-card/).elements().length)
      .toBe(0);

    await app.unmount();
  });

  it("shows rejected and unknown states", async ({ worker }) => {
    worker.use(
      ...mockKycRequiredDefaultYield(),
      mockKycStatus({ status: "rejected" }).handler
    );

    const rejectedApp = await renderApp({ skProps });

    await expect
      .element(rejectedApp.getByTestId("kyc-gate-card-rejected"))
      .toBeInTheDocument();
    await expect
      .element(rejectedApp.getByText("Verification not approved"))
      .toBeInTheDocument();

    await rejectedApp.unmount();

    worker.use(
      ...mockKycRequiredDefaultYield(),
      http.get(yieldApiRoute("/v1/yields/:yieldId/kyc/status"), async () => {
        await mockDelay();

        return HttpResponse.json(
          { message: "Unable to fetch KYC status" },
          { status: 500 }
        );
      })
    );

    const unknownApp = await renderApp({ skProps });

    await expect
      .element(unknownApp.getByTestId("kyc-gate-card-unknown"))
      .toBeInTheDocument();
    await expect
      .element(unknownApp.getByText("Verification status unavailable"))
      .toBeInTheDocument();

    await unknownApp.unmount();
  });

  it("does not show a card for approved or not required status", async ({
    worker,
  }) => {
    worker.use(
      ...mockKycRequiredDefaultYield(),
      mockKycStatus({ status: "approved" }).handler
    );

    const approvedApp = await renderApp({ skProps });

    await expect
      .poll(() => approvedApp.getByTestId(/^kyc-gate-card/).elements().length)
      .toBe(0);

    await approvedApp.unmount();

    worker.use(
      ...mockKycRequiredDefaultYield(),
      mockKycStatus({ status: "not_required" }).handler
    );

    const notRequiredApp = await renderApp({ skProps });

    await expect
      .poll(
        () => notRequiredApp.getByTestId(/^kyc-gate-card/).elements().length
      )
      .toBe(0);

    await notRequiredApp.unmount();
  });

  it("keeps enter action 412 KYC failures on the global error path", async ({
    worker,
  }) => {
    const { customConnectors } = await setupStakingFlow(worker);

    const kycStatus = mockKycStatus({ status: "approved" });

    worker.use(
      kycStatus.handler,
      http.post(yieldApiRoute("/v1/actions/enter"), async () => {
        await mockDelay();

        return HttpResponse.json(
          {
            message: "KYC required",
            details: {
              protocol: "Superstate",
              authorizeUrl: "https://issuer.example/verify",
            },
          },
          { status: 412 }
        );
      })
    );

    const app = await renderApp({
      walletListFactory: customConnectors,
    });

    await expect
      .element(app.getByText(formatAddress(account)))
      .toBeInTheDocument();

    await app.getByTestId("select-opportunity").click();

    await app
      .getByTestId("select-modal__container")
      .getByTestId(/^select-opportunity__item_avalanche-avax-liquid-staking/)
      .click();

    await userEvent.click(app.getByTestId("number-input"));
    await userEvent.keyboard("0.1");
    await userEvent.click(app.getByText("Stake").last());

    await expect
      .element(app.getByText("Something went wrong"))
      .toBeInTheDocument();
    await expect
      .poll(() => app.getByTestId("kyc-gate-card-start_kyc").elements().length)
      .toBe(0);

    await app.unmount();
  });

  it("keeps exit action 412 KYC failures on the global error path", async ({
    worker,
  }) => {
    const { account, customConnectors, legacyYield, setUrl } =
      await setupTrustPosition(worker);

    setUrl({
      accountId: account,
      balanceId: "default",
      yieldId: legacyYield.id,
    });

    const kycStatus = mockKycStatus({ status: "approved" });

    worker.use(
      kycStatus.handler,
      http.post(yieldApiRoute("/v1/actions/exit"), async () => {
        await mockDelay();

        return HttpResponse.json(
          {
            message: "KYC required",
            details: {
              protocol: "Superstate",
              authorizeUrl: "https://issuer.example/verify",
            },
          },
          { status: 412 }
        );
      })
    );

    const app = await renderApp({
      walletListFactory: customConnectors,
    });

    await expect.element(app.getByText("Trust USDA Earn")).toBeInTheDocument();

    const withdrawButton = app
      .getByRole("button", { exact: true, name: "Withdraw" })
      .last();

    await expect.element(withdrawButton).toBeEnabled();
    await userEvent.click(withdrawButton);

    await expect
      .element(app.getByText("Something went wrong"))
      .toBeInTheDocument();
    await expect
      .poll(() => app.getByTestId("kyc-gate-card-start_kyc").elements().length)
      .toBe(0);

    await app.unmount();
  });
});
