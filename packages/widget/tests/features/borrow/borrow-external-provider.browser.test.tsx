import { HttpResponse, http } from "msw";
import { base, mainnet, polygon } from "viem/chains";
import { userEvent } from "vitest/browser";
import { SKApp } from "../../../src/App";
import type { SKAppProps } from "../../../src/public-api/react-types";
import type {
  SKBorrowSignatureResult,
  SKBorrowTx,
  SKBorrowTxMeta,
  SKBorrowTxResult,
  SKBorrowWallet,
  SKEip712TypedData,
} from "../../../src/public-api/types";
import { borrowApiRoute, yieldApiRoute } from "../../mocks/api-routes";
import { describe, expect, it, vi } from "../../utils/test-extend";
import { type RenderResult, render, renderApp } from "../../utils/test-utils";

const account = "0x0000000000000000000000000000000000000001";
const transactionHash =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

const integration = {
  id: "aave-borrow",
  providerId: "aave",
  name: "Aave V3 Borrow",
  networks: ["ethereum"],
  metadata: {
    description: "Aave lending and borrowing",
    externalLink: "https://aave.com",
    logoURI: "https://assets.stakek.it/protocols/aave.svg",
  },
  actions: [],
} as const;

const collateralToken = {
  address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  symbol: "WETH",
  name: "Wrapped Ether",
  decimals: 18,
} as const;

const market = {
  id: "aave-v3-ethereum-usdc",
  integrationId: integration.id,
  network: "ethereum",
  type: "pool",
  poolAddress: "0x0000000000000000000000000000000000000001",
  loanToken: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  collateralTokens: [
    {
      token: collateralToken,
      priceUsd: "2000",
      maxLtv: "0.8",
      liquidationThreshold: "0.85",
      liquidationPenalty: "0.05",
      supplyRate: "0.02",
    },
  ],
  borrowRate: "0.06",
  totalSupply: "1000000",
  totalSupplyRaw: "1000000000000",
  totalBorrow: "500000",
  totalBorrowRaw: "500000000000",
  availableLiquidity: "500000",
  availableLiquidityRaw: "500000000000",
  utilizationRate: "0.5",
  loanTokenPriceUsd: "1",
  isBorrowEnabled: true,
  supplyCollateralFeeBps: "0",
  feeWrapperAddress: null,
  originationFeeBps: "0",
  originationFeeWrapperAddress: null,
  blueBundleOriginationFeeBps: null,
  minLoan: null,
} as const;

const position = {
  address: account,
  availableToBorrowUsd: "450",
  currentLtv: "0.4",
  debtBalances: [
    {
      apy: "0.06",
      balance: "400",
      balanceRaw: "400000000",
      balanceUsd: "400",
      marketId: market.id,
      pendingActions: [],
      tokenAddress: market.loanToken.address,
      tokenSymbol: "USDC",
    },
  ],
  healthFactor: "2.125",
  integrationId: integration.id,
  netApy: "-0.006",
  netWorthUsd: "600",
  network: "ethereum",
  supplyBalances: [
    {
      apy: "0.02",
      balance: "0.5",
      balanceRaw: "500000000000000000",
      balanceUsd: "1000",
      isCollateral: true,
      marketId: market.id,
      pendingActions: [
        {
          args: {
            amountRaw: "500000000000000000",
            marketId: market.id,
            tokenAddress: collateralToken.address,
          },
          label: "Withdraw",
          type: "withdraw",
        },
      ],
      positionState: {
        availableToBorrowUsd: "450",
        currentLtv: "0.4",
        healthFactor: "2.125",
        liquidationThreshold: "0.85",
      },
      tokenAddress: collateralToken.address,
      tokenSymbol: "WETH",
    },
  ],
  totalBorrowedUsd: "400",
  totalCollateralUsd: "1000",
  totalSuppliedUsd: "1000",
};

const typedData = {
  domain: {
    chainId: 1,
    name: "Borrow Authorization",
    verifyingContract: "0x0000000000000000000000000000000000000002",
    version: "1",
  },
  message: { owner: account },
  primaryType: "Authorization",
  types: {
    Authorization: [{ name: "owner", type: "address" }],
  },
} as const satisfies SKEip712TypedData;

const authorizeTransaction = {
  address: account,
  chainId: "1",
  id: "authorize-transaction",
  network: "ethereum",
  signablePayload: JSON.stringify({
    ...typedData,
    types: {
      ...typedData.types,
      EIP712Domain: [{ name: "name", type: "string" }],
    },
  }),
  signingFormat: "EIP712_TYPED_DATA",
  status: "WAITING_FOR_SIGNATURE",
  type: "AUTHORIZE",
} as const;

const withdrawTransaction = {
  address: account,
  chainId: "1",
  id: "withdraw-transaction",
  network: "ethereum",
  signablePayload: JSON.stringify({
    data: "0xabcdef",
    from: account,
    gasLimit: "21000",
    maxFeePerGas: "9",
    maxPriorityFeePerGas: "2",
    to: "0x0000000000000000000000000000000000000002",
    type: 2,
  }),
  signingFormat: "EVM_TRANSACTION",
  status: "WAITING_FOR_SIGNATURE",
  type: "WITHDRAW",
} as const;

const makeBorrowApi = ({
  failFirstSubmit = false,
}: {
  readonly failFirstSubmit?: boolean;
} = {}) => {
  const submitted = new Map<string, unknown>();
  let submitAttempts = 0;
  const action = (transactions: ReadonlyArray<{ readonly id: string }>) => ({
    action: "withdraw",
    address: account,
    createdAt: "2026-01-01T00:00:00.000Z",
    currentStep: 1,
    hasNextStep: false,
    id: "withdraw-action",
    integrationId: integration.id,
    rawArguments: {
      amount: "0.1",
      marketId: market.id,
      tokenAddress: collateralToken.address,
    },
    status: transactions.every(({ id }) => submitted.has(id))
      ? "SUCCESS"
      : "CREATED",
    totalSteps: 1,
    transactions: transactions.map((transaction) => ({
      ...transaction,
      status: submitted.has(transaction.id)
        ? "CONFIRMED"
        : "WAITING_FOR_SIGNATURE",
    })),
  });

  return {
    handlers: (transactions: ReadonlyArray<{ readonly id: string }>) => [
      http.get(borrowApiRoute("/v1/integrations"), () =>
        HttpResponse.json([integration])
      ),
      http.get(borrowApiRoute("/v1/markets"), () =>
        HttpResponse.json({ items: [market], limit: 100, offset: 0, total: 1 })
      ),
      http.get(borrowApiRoute("/v1/positions"), () =>
        HttpResponse.json(position)
      ),
      http.post(borrowApiRoute("/v1/actions"), () =>
        HttpResponse.json(action(transactions))
      ),
      http.get(borrowApiRoute("/v1/actions/withdraw-action"), () =>
        HttpResponse.json(action(transactions))
      ),
      http.post(
        borrowApiRoute("/v1/transactions/:transactionId/submit"),
        async ({ params, request }) => {
          submitAttempts += 1;
          if (failFirstSubmit && submitAttempts === 1) {
            return new HttpResponse(null, { status: 400 });
          }
          submitted.set(String(params.transactionId), await request.json());
          return HttpResponse.json({
            link: `https://etherscan.io/tx/${transactionHash}`,
            status: "BROADCASTED",
            transactionHash,
          });
        }
      ),
    ],
    submitted,
  };
};

const makeWallet = (
  callbacks: Pick<SKBorrowWallet, "sendBorrowTransaction"> &
    Partial<Pick<SKBorrowWallet, "signTypedData">>
): SKBorrowWallet => ({
  sendTransaction: async () => "yield-hash",
  signMessage: async () => "signature",
  signTypedData: async () => ({ type: "success", signature: "0xsignature" }),
  switchChain: async () => {},
  ...callbacks,
});

const broadcastSuccess: SKBorrowTxResult = {
  type: "success",
  txHash: transactionHash,
};

const completePageShown = (app: RenderResult) =>
  app.container.querySelector('[data-rk="borrow-complete-page"]') !== null;

const stepsPageShown = (app: RenderResult) =>
  app.container.querySelector('[data-rk="borrow-steps-page"]') !== null;

const renderBorrowApp = (wallet: SKBorrowWallet) =>
  renderApp({
    skProps: {
      apiKey: import.meta.env.VITE_API_KEY,
      borrowEnabled: true,
      dashboardVariant: true,
      externalProviders: {
        currentAddress: account,
        currentChain: mainnet.id,
        provider: wallet,
        supportedChainIds: [mainnet.id],
        type: "generic",
      },
    },
  });

// Confirms a withdraw; a fast host can finish the flow before Steps renders.
const confirmWithdraw = async (app: RenderResult) => {
  await userEvent.click(app.getByText("Manage"));
  await userEvent.click(app.getByText("WETH/USDC"));
  await app.getByTestId("borrow-position-action__withdraw").click();
  await userEvent.click(app.getByTestId("number-input"));
  await userEvent.keyboard("0.1");
  await app.getByRole("button", { name: "Review withdrawal" }).click();
  await app.getByRole("button", { name: "Confirm" }).click();
};

describe("Borrow with an external provider", () => {
  it("signs typed data and broadcasts through the host with Borrow metadata", async ({
    worker,
  }) => {
    const api = makeBorrowApi();
    worker.use(...api.handlers([authorizeTransaction, withdrawTransaction]));
    const broadcast = Promise.withResolvers<SKBorrowTxResult>();
    const signTypedData = vi.fn(
      async (
        _typedData: SKEip712TypedData,
        _txMeta: SKBorrowTxMeta
      ): Promise<SKBorrowSignatureResult> => ({
        type: "success",
        signature: "0xsignature",
      })
    );
    const sendBorrowTransaction = vi.fn(
      (_tx: SKBorrowTx, _txMeta: SKBorrowTxMeta) => broadcast.promise
    );

    const app = await renderBorrowApp(
      makeWallet({ sendBorrowTransaction, signTypedData })
    );
    await confirmWithdraw(app);

    await expect.poll(() => sendBorrowTransaction).toHaveBeenCalledOnce();
    await expect
      .element(app.getByRole("button", { name: "Back to position" }))
      .toBeEnabled();
    await expect
      .element(app.getByRole("button", { name: "Cancel" }))
      .toBeEnabled();

    broadcast.resolve(broadcastSuccess);
    await expect.poll(() => completePageShown(app)).toBe(true);

    expect(signTypedData).toHaveBeenCalledWith(
      typedData,
      expect.objectContaining({
        actionId: "withdraw-action",
        actionType: "withdraw",
        txId: authorizeTransaction.id,
        txType: "AUTHORIZE",
      })
    );
    expect(sendBorrowTransaction).toHaveBeenCalledWith(
      {
        type: "evm",
        tx: {
          chainId: "0x1",
          data: "0xabcdef",
          from: account,
          gas: "0x5208",
          maxFeePerGas: "0x9",
          maxPriorityFeePerGas: "0x2",
          to: "0x0000000000000000000000000000000000000002",
          type: "0x2",
          value: undefined,
        },
      },
      expect.objectContaining({
        actionId: "withdraw-action",
        txId: withdrawTransaction.id,
        txType: "WITHDRAW",
      })
    );
    expect(Object.fromEntries(api.submitted)).toEqual({
      [authorizeTransaction.id]: { signedPayload: "0xsignature" },
      [withdrawTransaction.id]: { transactionHash },
    });

    await app.unmount();
  });

  it("leaves after hash submission fails and registers the held hash", async ({
    worker,
  }) => {
    const api = makeBorrowApi({ failFirstSubmit: true });
    worker.use(...api.handlers([withdrawTransaction]));
    const sendBorrowTransaction = vi
      .fn<SKBorrowWallet["sendBorrowTransaction"]>()
      .mockResolvedValueOnce({ type: "error", error: "Blocked by host policy" })
      .mockResolvedValue(broadcastSuccess);

    const app = await renderBorrowApp(makeWallet({ sendBorrowTransaction }));
    await confirmWithdraw(app);

    await expect
      .element(app.getByText("Blocked by host policy"))
      .toBeInTheDocument();
    await expect
      .element(app.getByRole("button", { name: "Cancel" }))
      .toBeEnabled();

    await app.getByRole("button", { name: "Try Again" }).click();
    await expect
      .element(app.getByText("Borrow transaction could not be submitted."))
      .toBeInTheDocument();
    expect(api.submitted.has(withdrawTransaction.id)).toBe(false);
    await expect
      .element(app.getByRole("button", { name: "Back to position" }))
      .toBeEnabled();

    await app.getByRole("button", { name: "Cancel" }).click();
    // The host broadcast the transaction, so leaving asks first.
    await app.getByRole("button", { name: "Leave" }).click();
    await expect.poll(() => stepsPageShown(app)).toBe(false);
    await expect
      .poll(() => api.submitted.get(withdrawTransaction.id))
      .toEqual({ transactionHash });
    expect(sendBorrowTransaction).toHaveBeenCalledTimes(2);
    expect(completePageShown(app)).toBe(false);

    await app.unmount();
  });

  it("treats a wallet cancellation as a retryable step, not a failure", async ({
    worker,
  }) => {
    const api = makeBorrowApi();
    worker.use(...api.handlers([withdrawTransaction]));
    const sendBorrowTransaction = vi
      .fn<SKBorrowWallet["sendBorrowTransaction"]>()
      .mockResolvedValueOnce({ type: "cancelled" })
      .mockResolvedValue(broadcastSuccess);

    const app = await renderBorrowApp(makeWallet({ sendBorrowTransaction }));
    await confirmWithdraw(app);

    await expect
      .element(app.getByText("You cancelled this request in your wallet."))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("Withdrawal failed"))
      .not.toBeInTheDocument();
    await expect
      .element(app.getByRole("button", { name: "Cancel" }))
      .toBeEnabled();

    await app.getByRole("button", { name: "Try Again" }).click();
    await expect.poll(() => completePageShown(app)).toBe(true);
    expect(sendBorrowTransaction).toHaveBeenCalledTimes(2);

    await app.unmount();
  });

  it("tracks a transaction the host broadcast before failing instead of signing it again", async ({
    worker,
  }) => {
    const api = makeBorrowApi();
    worker.use(...api.handlers([withdrawTransaction]));
    const sendBorrowTransaction = vi
      .fn<SKBorrowWallet["sendBorrowTransaction"]>()
      .mockResolvedValue({
        type: "error",
        error: "Receipt timed out",
        txHash: transactionHash,
      });

    const app = await renderBorrowApp(makeWallet({ sendBorrowTransaction }));
    await confirmWithdraw(app);

    await expect.poll(() => completePageShown(app)).toBe(true);
    expect(sendBorrowTransaction).toHaveBeenCalledOnce();
    expect(api.submitted.get(withdrawTransaction.id)).toEqual({
      transactionHash,
    });

    await app.unmount();
  });
});

describe("Borrow on a network outside Borrow", () => {
  it("switches the host wallet to a chosen Borrow chain and loads its markets", async ({
    worker,
  }) => {
    const marketNetworks: Array<string | null> = [];
    const baseIntegration = { ...integration, networks: ["base"] };
    const baseMarket = { ...market, id: "aave-v3-base-usdc", network: "base" };
    worker.use(
      http.get(yieldApiRoute("/v1/networks"), () =>
        HttpResponse.json([
          { id: "ethereum" },
          { id: "base" },
          { id: "polygon" },
        ])
      ),
      http.get(borrowApiRoute("/v1/integrations"), () =>
        HttpResponse.json([baseIntegration])
      ),
      http.get(borrowApiRoute("/v1/markets"), ({ request }) => {
        marketNetworks.push(new URL(request.url).searchParams.get("network"));
        return HttpResponse.json({
          items: [baseMarket],
          limit: 100,
          offset: 0,
          total: 1,
        });
      }),
      http.get(borrowApiRoute("/v1/positions"), () =>
        HttpResponse.json({ ...position, network: "base" })
      )
    );
    const switchChain = vi.fn(async (_chainId: number) => {});
    const props = (
      currentChain: typeof polygon.id | typeof base.id
    ): SKAppProps => ({
      apiKey: import.meta.env.VITE_API_KEY,
      borrowEnabled: true,
      dashboardVariant: true,
      externalProviders: {
        currentAddress: account,
        currentChain,
        provider: {
          ...makeWallet({ sendBorrowTransaction: vi.fn() }),
          switchChain,
        },
        supportedChainIds: [mainnet.id, base.id],
        type: "generic",
      },
    });

    const app = await render(<SKApp {...props(polygon.id)} />);
    await userEvent.click(app.getByText("Borrow", { exact: true }));

    await expect
      .element(app.getByText("Unsupported network"))
      .toBeInTheDocument();
    await app.getByRole("button", { name: "Switch network" }).click();
    await expect
      .element(app.getByTestId(`wallet-chain-${polygon.id}`))
      .not.toBeInTheDocument();
    await app.getByTestId(`wallet-chain-${base.id}`).click();

    await expect.poll(() => switchChain).toHaveBeenCalledWith(base.id);
    // The host reports the chain its wallet switched to.
    await app.rerender(<SKApp {...props(base.id)} />);
    await expect.poll(() => marketNetworks).toContain("base");
    await expect
      .element(app.getByText("Collateral", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(app.getByRole("button", { name: "Enter amounts" }))
      .toBeInTheDocument();

    await app.unmount();
  });

  it("interrupts a pending switch when the network picker closes", async ({
    worker,
  }) => {
    worker.use(
      // The host's chain is enabled for the key but outside its own supported
      // list, so Borrow offers the in-widget network switch.
      http.get(yieldApiRoute("/v1/networks"), () =>
        HttpResponse.json([
          { id: "ethereum" },
          { id: "base" },
          { id: "polygon" },
        ])
      ),
      http.get(borrowApiRoute("/v1/integrations"), () =>
        HttpResponse.json([{ ...integration, networks: ["base"] }])
      )
    );
    // The host never finishes switching, so only closing the picker ends it.
    const switchChain = vi.fn(
      (_chainId: number) => new Promise<void>(() => {})
    );
    const app = await render(
      <SKApp
        apiKey={import.meta.env.VITE_API_KEY}
        borrowEnabled
        dashboardVariant
        externalProviders={{
          currentAddress: account,
          currentChain: polygon.id,
          provider: {
            ...makeWallet({ sendBorrowTransaction: vi.fn() }),
            switchChain,
          },
          supportedChainIds: [mainnet.id, base.id],
          type: "generic",
        }}
      />
    );
    await userEvent.click(app.getByText("Borrow", { exact: true }));
    const switchNetwork = app.getByRole("button", { name: "Switch network" });
    await switchNetwork.click();
    await app.getByTestId(`wallet-chain-${base.id}`).click();
    await expect.poll(() => switchChain).toHaveBeenCalledWith(base.id);
    await expect
      .element(app.getByRole("status").getByText("Confirm in Wallet"))
      .toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    await expect
      .element(app.getByTestId(`wallet-chain-${base.id}`))
      .not.toBeInTheDocument();
    await expect.element(switchNetwork).toBeEnabled();

    await app.unmount();
  });
});
