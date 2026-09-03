import { useAtom } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { act, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { SKAtomRegistryProvider } from "../../src/app/composition/providers/atom-runtime";
import { applicationRoutes } from "../../src/app/routes/application-routes";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import {
  PositionDetailsWorkflowKey,
  positionDetailsWorkflowAtom,
  reducePositionDetailsWorkflow,
} from "../../src/features/position-details/state/workflow";
import { render } from "../utils/test-utils.dom.tsx";

const settings = {
  apiKey: "test-api-key",
  variant: "default" as const,
};

const positionWorkflowAtom = positionDetailsWorkflowAtom(
  new PositionDetailsWorkflowKey({
    balanceId: "balance-1",
    integrationId: "yield-1",
    pendingActionType: null,
    scope: new WalletScopeKey({
      address: Schema.decodeSync(WalletAddress)("0xwallet-a"),
      network: "ethereum",
    }),
  })
);

const PositionAmountHarness = () => {
  const [workflow, setWorkflow] = useAtom(positionWorkflowAtom);

  return (
    <>
      <output>{workflow.unstakeAmount.toFixed()}</output>
      <button
        type="button"
        onClick={() =>
          setWorkflow(
            reducePositionDetailsWorkflow({
              action: { type: "unstake/amount/max" },
              maxUnstakeAmount: new BigNumber(5),
              state: workflow,
            })
          )
        }
      >
        Max
      </button>
    </>
  );
};

const renderWorkflow = (children: ReactNode) =>
  render(
    <SKAtomRegistryProvider
      routes={applicationRoutes}
      hostConfiguration={settings}
    >
      {children}
    </SKAtomRegistryProvider>
  );

describe("page workflow atom adapters", () => {
  it("updates the visible position amount through the workflow atom", async () => {
    const app = await renderWorkflow(<PositionAmountHarness />);

    expect(app.container.querySelector("output")?.textContent).toBe("0");
    await act(async () => app.container.querySelector("button")?.click());
    expect(app.container.querySelector("output")?.textContent).toBe("5");
  });
});
