import {
  RegistryProvider,
  useAtom,
  useAtomSet,
  useAtomValue,
} from "@effect/atom-react";
import BigNumber from "bignumber.js";
import { Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { EarnPosition } from "../../src/domain/earn/models";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import {
  PositionDetailsWorkflowKey,
  positionDetailsWorkflowAtom,
} from "../../src/features/position-details/state/workflow";
import {
  PositionBalancesKey,
  positionBalancesAtom,
  positionBalancesByTypeAtom,
  yieldPositionsResourceAtom,
} from "../../src/resources/yield-positions/yield-positions";
import { yieldApiYieldFixture, yieldBalanceFixture } from "../fixtures";
import { render } from "../utils/test-utils.dom.tsx";

const address = (suffix: string) =>
  Schema.decodeSync(WalletAddress)(`0x${suffix.padStart(40, "0")}`);
const scopeA = new WalletScopeKey({
  address: address("1"),
  network: "ethereum",
});
const scopeB = new WalletScopeKey({
  address: address("2"),
  network: "ethereum",
});
const yieldDto = yieldApiYieldFixture();
const position = Schema.decodeUnknownSync(EarnPosition)({
  balances: [
    yieldBalanceFixture({
      address: scopeA.address,
      amount: "5",
      amountRaw: "5000000000000000000",
      amountUsd: "25",
      pendingActions: [
        {
          amount: "5",
          arguments: { fields: [] },
          intent: "manage",
          passthrough: "wallet-a-action",
          type: "CLAIM_REWARDS",
        },
      ],
      token: yieldDto.token,
      type: "active",
    }),
  ],
  outputTokenBalance: null,
  yieldId: yieldDto.id,
});

const stagedActionAttemptsAtom = Atom.make<ReadonlyArray<string>>([]).pipe(
  Atom.keepAlive
);

const PositionRouteHarness = ({
  scope,
}: {
  readonly scope: WalletScopeKey;
}) => {
  const key = new PositionBalancesKey({
    balanceId: "default",
    scope,
    yieldId: position.yieldId,
  });
  const balancesResult = useAtomValue(positionBalancesAtom(key));
  const balances = Option.getOrNull(AsyncResult.value(balancesResult));
  const balancesByType = Option.getOrNull(
    AsyncResult.value(useAtomValue(positionBalancesByTypeAtom(key)))
  );
  const [workflow, setWorkflow] = useAtom(
    positionDetailsWorkflowAtom(
      new PositionDetailsWorkflowKey({
        balanceId: "default",
        integrationId: position.yieldId,
        pendingActionType: null,
        scope,
      })
    )
  );
  const setAttempts = useAtomSet(stagedActionAttemptsAtom);
  const attempts = useAtomValue(stagedActionAttemptsAtom);
  const activeBalance = balancesByType?.get("active")?.[0] ?? null;
  const stage = (kind: string) => {
    if (balances) {
      setAttempts((current) => [...current, kind]);
    }
  };

  return (
    <>
      <output data-testid="balance">
        {activeBalance?.amount.toFixed() ?? "empty"}
      </output>
      <output data-testid="price">
        {activeBalance?.tokenPriceInUsd.toFixed() ?? "empty"}
      </output>
      <output data-testid="pending">
        {activeBalance?.pendingActions.length ?? 0}
      </output>
      <output data-testid="amount">{workflow.unstakeAmount.toFixed()}</output>
      <output data-testid="attempts">{attempts.join(",") || "none"}</output>
      <button
        type="button"
        onClick={() =>
          setWorkflow({
            ...workflow,
            unstakeAmount: new BigNumber(5),
          })
        }
      >
        Seed action state
      </button>
      <button type="button" onClick={() => stage("exit")}>
        Exit
      </button>
      <button type="button" onClick={() => stage("pending")}>
        Pending action
      </button>
    </>
  );
};

describe("dashboard position wallet ownership", () => {
  it("clears wallet A data and action state before wallet B can stage an action", async () => {
    const resourceA = yieldPositionsResourceAtom(scopeA);
    const resourceB = yieldPositionsResourceAtom(scopeB);
    const wrapper = (scope: WalletScopeKey) => (
      <RegistryProvider
        initialValues={[
          [resourceA, AsyncResult.success({ errors: [], items: [position] })],
          [resourceB, AsyncResult.success({ errors: [], items: [] })],
        ]}
      >
        <PositionRouteHarness scope={scope} />
      </RegistryProvider>
    );
    const app = await render(wrapper(scopeA));

    expect(
      app.container.querySelector('[data-testid="balance"]')?.textContent
    ).toBe("5");
    expect(
      app.container.querySelector('[data-testid="price"]')?.textContent
    ).toBe("25");
    expect(
      app.container.querySelector('[data-testid="pending"]')?.textContent
    ).toBe("1");
    await act(async () =>
      app.container.querySelector<HTMLButtonElement>("button")?.click()
    );
    expect(
      app.container.querySelector('[data-testid="amount"]')?.textContent
    ).toBe("5");

    await app.rerender(wrapper(scopeB));

    expect(
      app.container.querySelector('[data-testid="balance"]')?.textContent
    ).toBe("empty");
    expect(
      app.container.querySelector('[data-testid="price"]')?.textContent
    ).toBe("empty");
    expect(
      app.container.querySelector('[data-testid="pending"]')?.textContent
    ).toBe("0");
    expect(
      app.container.querySelector('[data-testid="amount"]')?.textContent
    ).toBe("0");

    const buttons = app.container.querySelectorAll<HTMLButtonElement>("button");
    await act(async () => {
      buttons[1]?.click();
      buttons[2]?.click();
    });
    expect(
      app.container.querySelector('[data-testid="attempts"]')?.textContent
    ).toBe("none");
  });
});
