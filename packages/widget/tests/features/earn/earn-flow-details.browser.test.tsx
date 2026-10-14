import { Schema } from "effect";
import { HttpResponse, http } from "msw";
import { userEvent } from "vitest/browser";
import { SKApp } from "../../../src/App";
import { YieldId } from "../../../src/domain/identity/identifiers";
import { useEarnYieldSelection } from "../../../src/features/earn/index";
import type { SKAppProps } from "../../../src/public-api/react-types";
import {
  yieldApiActionDtoFixture,
  yieldApiTransactionDtoFixture,
  yieldApiYieldDtoFixture,
} from "../../fixtures";
import { legacyApiRoute, yieldApiRoute } from "../../mocks/api-routes";
import { describe, expect, it } from "../../utils/test-extend";
import { render } from "../../utils/test-utils";

const address = "0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7";

const token = {
  name: "Ethereum",
  symbol: "ETH",
  decimals: 18,
  network: "ethereum",
  coinGeckoId: "ethereum",
  logoURI: "https://assets.stakek.it/tokens/eth.svg",
} as const;

const makeYield = (id: string, name: string) =>
  yieldApiYieldDtoFixture({
    id,
    metadata: {
      ...yieldApiYieldDtoFixture().metadata,
      description: `${name} description`,
      name,
    },
    token,
    tokens: [token],
    inputTokens: [token],
    outputToken: token,
  });

const alpha = makeYield("ethereum-eth-alpha-staking", "Alpha Staking");
const beta = makeYield("ethereum-eth-beta-staking", "Beta Staking");
const yields = [alpha, beta];

const props: SKAppProps = {
  apiKey: import.meta.env.VITE_API_KEY,
  dashboardVariant: true,
  externalProviders: {
    type: "generic",
    currentAddress: address,
    currentChain: 1,
    provider: {
      signMessage: async () => "signature",
      switchChain: async () => {},
      sendTransaction: async () => "hash",
    },
  },
};

/** Drives the Earn form's live selection from outside the widget's UI. */
const SelectionProbe = () => {
  const { select, view } = useEarnYieldSelection();

  return (
    <>
      <output data-testid="live-selected-yield">{view.selected?.id}</output>
      <button
        onClick={() => select(Schema.decodeSync(YieldId)(alpha.id))}
        type="button"
      >
        live-select-alpha
      </button>
      <button
        onClick={() => select(Schema.decodeSync(YieldId)(beta.id))}
        type="button"
      >
        live-select-beta
      </button>
    </>
  );
};

describe("Dashboard Earn flow details", () => {
  it("keeps describing the started flow's yield when the live Earn selection changes", async ({
    worker,
  }) => {
    const balances = [
      {
        token,
        amount: "3",
        availableYields: yields.map((item) => item.id),
      },
    ];

    worker.use(
      http.get(yieldApiRoute("/v1/networks"), () =>
        HttpResponse.json([{ id: token.network }])
      ),
      http.get(legacyApiRoute("/v1/tokens"), () =>
        HttpResponse.json([
          { token, availableYields: yields.map((item) => item.id) },
        ])
      ),
      http.get(
        legacyApiRoute("/v2/networks/:network/addresses/:address/tokens"),
        () => HttpResponse.json(balances)
      ),
      http.post(legacyApiRoute("/v1/tokens/balances"), () =>
        HttpResponse.json(balances)
      ),
      http.get(yieldApiRoute("/v1/yields"), () =>
        HttpResponse.json({
          items: yields,
          total: yields.length,
          offset: 0,
          limit: 100,
        })
      ),
      http.get(yieldApiRoute("/v1/yields/:yieldId"), ({ params }) => {
        const found = yields.find((item) => item.id === params.yieldId);
        return found
          ? HttpResponse.json(found)
          : new HttpResponse(null, { status: 404 });
      }),
      http.post(yieldApiRoute("/v1/actions/enter"), async ({ request }) => {
        const body = (await request.json()) as {
          readonly arguments?: { readonly amount?: string };
          readonly yieldId: string;
        };
        return HttpResponse.json(
          yieldApiActionDtoFixture({
            address,
            amount: body.arguments?.amount ?? null,
            rawArguments: body.arguments ?? null,
            transactions: [
              yieldApiTransactionDtoFixture({
                network: token.network,
                stepIndex: 0,
                type: "STAKE",
              }),
            ],
            yieldId: body.yieldId,
          })
        );
      })
    );

    const app = await render(
      <SKApp {...props}>
        <SelectionProbe />
      </SKApp>
    );

    await userEvent.click(app.getByText("live-select-alpha"));
    await expect
      .element(app.getByTestId("live-selected-yield"))
      .toHaveTextContent(alpha.id);
    await expect
      .element(app.getByText("Alpha Staking description"))
      .toBeInTheDocument();

    await userEvent.click(app.getByTestId("number-input"));
    await userEvent.keyboard("0.1");
    await expect.element(app.getByTestId("number-input")).toHaveValue("0.1");
    await userEvent.click(app.getByRole("button", { name: "Stake" }).last());

    await expect
      .element(app.getByTestId("estimated_gas_fee"))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("Alpha Staking description"))
      .toBeInTheDocument();

    // The Earn form falls back to another yield while the flow keeps
    // executing against Alpha.
    await userEvent.click(app.getByText("live-select-beta"));
    await expect
      .element(app.getByTestId("live-selected-yield"))
      .toHaveTextContent(beta.id);

    await expect
      .element(app.getByTestId("estimated_gas_fee"))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("Alpha Staking description"))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("Beta Staking description"))
      .not.toBeInTheDocument();

    await app.unmount();
  });
});
