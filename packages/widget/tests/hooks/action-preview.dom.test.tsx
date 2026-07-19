import { Schema } from "effect";
import { HttpResponse, http } from "msw";
import { type PropsWithChildren, useEffect } from "react";
import { normalizeWidgetConfig } from "../../src/app/config/settings";
import { ActionCommand } from "../../src/domain/schema/action-models";
import { useActionPreview } from "../../src/features/transaction-flow/react/use-action-preview";
import { useSetEnterStakeRequest } from "../../src/features/transaction-flow/react/use-transaction-flow";
import type { EnterStakeRequest } from "../../src/features/transaction-flow/state/enter-request";
import { yieldApiActionFixture, yieldApiTransactionFixture } from "../fixtures";
import { TestAtomRuntimeProvider } from "../utils/atom-runtime-provider";
import { describe, expect, it } from "../utils/test-extend.dom";
import { renderHook } from "../utils/test-utils.dom";

const yieldApiUrl = "https://yield.example.com";
const command = Schema.decodeUnknownSync(ActionCommand)({
  address: "0xWallet",
  yieldId: "ethereum-eth-native-staking",
});

const Wrapper = ({ children }: PropsWithChildren) => (
  <TestAtomRuntimeProvider
    settings={normalizeWidgetConfig({
      apiKey: "test-key",
      baseUrl: "https://api.example.com",
      variant: "default",
      yieldsApiUrl: yieldApiUrl,
    })}
  >
    {children}
  </TestAtomRuntimeProvider>
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
      () => {
        const setRequest = useSetEnterStakeRequest();

        useEffect(() => {
          setRequest({ requestDto: command } as unknown as EnterStakeRequest);
        }, [setRequest]);

        return useActionPreview({ enabled: true, intent: "enter" });
      },
      { wrapper: Wrapper }
    );

    await expect.poll(() => result.current.data?.id).toBe("action-1");
    expect(result.current.data?.transactions[0]?.gasEstimate).toBe(
      transaction.gasEstimate
    );
  });
});
