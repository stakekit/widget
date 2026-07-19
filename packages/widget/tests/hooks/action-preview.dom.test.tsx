import { useAtomValue } from "@effect/atom-react";
import { Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { HttpResponse, http } from "msw";
import { type PropsWithChildren, useEffect } from "react";
import { normalizeWidgetConfig } from "../../src/app/config/settings";
import { ActionCommand } from "../../src/domain/schema/action-models";
import type { ClassicTransactionFlowIntake } from "../../src/features/transaction-flow/model/classic-transaction-flow";
import { useStartClassicTransactionFlow } from "../../src/features/transaction-flow/react/use-transaction-flow";
import { classicTransactionFlowFacade } from "../../src/features/transaction-flow/state/classic-flow-facade";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
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
        const startFlow = useStartClassicTransactionFlow();

        useEffect(() => {
          startFlow({
            _tag: "Enter",
            gasFeeToken: { network: "ethereum" },
            providersDetails: [],
            request: command,
            selectedStake: {},
            selectedToken: {},
            selectedValidators: new Map(),
            walletScope: new WalletScopeKey({
              address: command.address,
              network: "ethereum",
            }),
          } as unknown as ClassicTransactionFlowIntake);
        }, [startFlow]);

        return useAtomValue(classicTransactionFlowFacade.actionPreviewAtom);
      },
      { wrapper: Wrapper }
    );

    const getAction = () =>
      result.current.pipe(AsyncResult.value, Option.getOrNull);
    await expect.poll(() => getAction()?.id).toBe("action-1");
    expect(getAction()?.transactions[0]?.gasEstimate).toBe(
      transaction.gasEstimate
    );
  });
});
