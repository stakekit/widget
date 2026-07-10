import { HttpResponse, http } from "msw";
import type { PropsWithChildren } from "react";
import { useActionPreview } from "../../src/hooks/api/use-action-preview";
import { SKAtomRuntimeProvider } from "../../src/providers/effect-atom-runtime";
import { SettingsContextProvider } from "../../src/providers/settings";
import { yieldApiActionFixture, yieldApiTransactionFixture } from "../fixtures";
import { describe, expect, it } from "../utils/test-extend";
import { renderHook } from "../utils/test-utils";

const yieldApiUrl = "https://yield.example.com";

const Wrapper = ({ children }: PropsWithChildren) => (
  <SettingsContextProvider
    apiKey="test-key"
    baseUrl="https://api.example.com"
    yieldsApiUrl={yieldApiUrl}
    variant="default"
  >
    <SKAtomRuntimeProvider>{children}</SKAtomRuntimeProvider>
  </SettingsContextProvider>
);

describe("action preview", () => {
  it("exposes a strictly decoded action from the Effect API service", async ({
    worker,
  }) => {
    const transaction = yieldApiTransactionFixture({
      gasEstimate: JSON.stringify({
        amount: "0.01",
        token: {
          decimals: 18,
          name: "Ethereum",
          network: "ethereum",
          symbol: "ETH",
        },
      }),
      id: "transaction-1",
      network: "ethereum",
    });
    worker.use(
      http.post(`${yieldApiUrl}/v1/actions/enter`, () =>
        HttpResponse.json(
          yieldApiActionFixture({
            address: "0xWallet",
            id: "action-1",
            transactions: [transaction],
            yieldId: "ethereum-eth-native-staking",
          })
        )
      )
    );

    const { result } = await renderHook(
      () =>
        useActionPreview({
          command: {
            address: "0xWallet",
            yieldId: "ethereum-eth-native-staking",
          },
          enabled: true,
          intent: "enter",
        }),
      { wrapper: Wrapper }
    );

    await expect.poll(() => result.current.data?.id).toBe("action-1");
    expect(result.current.data?.transactions[0]?.gasEstimate).toBe(
      transaction.gasEstimate
    );
  });
});
