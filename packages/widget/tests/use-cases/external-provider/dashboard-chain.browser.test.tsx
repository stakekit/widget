import { HttpResponse, http } from "msw";
import { SKApp } from "../../../src/App";
import { useEarnYieldSelection } from "../../../src/features/earn/index";
import type { SKAppProps } from "../../../src/public-api/react-types";
import { yieldApiYieldDtoFixture } from "../../fixtures";
import { legacyApiRoute, yieldApiRoute } from "../../mocks/api-routes";
import { describe, expect, it } from "../../utils/test-extend";
import { render } from "../../utils/test-utils";

const Selection = () => {
  const { view } = useEarnYieldSelection();
  return <output data-testid="selected-yield">{view.selected?.id}</output>;
};

const provider = {
  signMessage: async () => "signature",
  switchChain: async () => {},
  sendTransaction: async () => "hash",
};

const props = (currentChain: 42161 | 137): SKAppProps => ({
  apiKey: import.meta.env.VITE_API_KEY,
  dashboardVariant: true,
  externalProviders: {
    type: "generic",
    currentAddress: "0x0000000000000000000000000000000000000001",
    currentChain,
    provider,
  },
});

const yields = (["ethereum", "arbitrum", "polygon"] as const).map((network) => {
  const token = {
    network,
    name: `${network} deposit asset`,
    symbol: network.toUpperCase(),
    decimals: 18,
  };
  return yieldApiYieldDtoFixture({
    id: `${network}-test-staking`,
    metadata: {
      ...yieldApiYieldDtoFixture().metadata,
      name: `${network} staking opportunity`,
    },
    token,
    tokens: [token],
    inputTokens: [token],
    outputToken: token,
  });
});

describe("External provider dashboard chain", () => {
  it("replaces the selected opportunity when the host changes chain without remounting", async ({
    worker,
  }) => {
    worker.use(
      http.get(yieldApiRoute("/v1/networks"), () =>
        HttpResponse.json(yields.map((item) => ({ id: item.token.network })))
      ),
      http.get(legacyApiRoute("/v1/tokens"), ({ request }) => {
        const query = new URL(request.url).searchParams;
        const network = query.get("network");
        const types = query
          .getAll("yieldTypes")
          .flatMap((value) => value.split(","));
        const items = yields
          .filter(
            (item) =>
              (!network || item.token.network === network) &&
              (types.length === 0 || types.includes(item.mechanics.type))
          )
          .map((item) => ({ token: item.token, availableYields: [item.id] }));
        return HttpResponse.json(items);
      }),
      http.get(yieldApiRoute("/v1/yields"), () =>
        HttpResponse.json({
          items: yields,
          total: yields.length,
          offset: 0,
          limit: 100,
        })
      ),
      http.get(yieldApiRoute("/v1/yields/:yieldId"), ({ params }) =>
        HttpResponse.json(yields.find((item) => item.id === params.yieldId))
      )
    );
    const app = await render(
      <SKApp {...props(42161)}>
        <Selection />
      </SKApp>
    );
    await expect
      .element(app.getByTestId("selected-yield"))
      .toHaveTextContent("arbitrum-test-staking");
    await expect
      .element(app.getByText("ARBITRUM", { exact: true }).first())
      .toBeInTheDocument();
    await app.rerender(
      <SKApp {...props(137)}>
        <Selection />
      </SKApp>
    );
    await expect
      .element(app.getByTestId("selected-yield"))
      .toHaveTextContent("polygon-test-staking");
    await expect
      .element(app.getByText("POLYGON", { exact: true }).first())
      .toBeInTheDocument();
    await expect
      .element(app.getByText("ARBITRUM", { exact: true }))
      .not.toBeInTheDocument();
    await app.unmount();
  });
});
