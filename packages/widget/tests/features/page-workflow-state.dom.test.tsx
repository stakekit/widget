import { useAtom } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { act, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { SKAtomRegistryProvider } from "../../src/app/composition/providers/atom-runtime";
import { normalizeWidgetConfig } from "../../src/app/config";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  earnPageSubmittedAtom,
  getEarnPageValidation,
} from "../../src/features/earn";
import {
  PositionDetailsWorkflowKey,
  positionDetailsWorkflowAtom,
  reducePositionDetailsWorkflow,
} from "../../src/features/position-details/state";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import { render } from "../utils/test-utils.dom";

const settings = normalizeWidgetConfig({
  apiKey: "test-api-key",
  variant: "default",
});

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

const EarnValidationHarness = () => {
  const [submitted, setSubmitted] = useAtom(earnPageSubmittedAtom);
  const validation = getEarnPageValidation({
    connected: true,
    hasTronResource: true,
    stakeAmountGreaterThanAvailableAmount: false,
    stakeAmountGreaterThanMax: false,
    stakeAmountIsZero: true,
    stakeAmountLessThanMin: false,
    submitted,
    tronResourceRequired: false,
  });

  return (
    <>
      <button type="button" onClick={() => setSubmitted(true)}>
        Submit
      </button>
      {validation.submitted && validation.hasErrors ? (
        <p role="alert">Amount is required</p>
      ) : null}
    </>
  );
};

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
    <SKAtomRegistryProvider settings={settings}>
      {children}
    </SKAtomRegistryProvider>
  );

describe("page workflow atom adapters", () => {
  it("shows earn validation after submission", async () => {
    const app = await renderWorkflow(<EarnValidationHarness />);

    expect(app.container.querySelector('[role="alert"]')).toBeNull();
    await act(async () => app.container.querySelector("button")?.click());
    expect(app.container.querySelector('[role="alert"]')?.textContent).toBe(
      "Amount is required"
    );
  });

  it("updates the visible position amount through the workflow atom", async () => {
    const app = await renderWorkflow(<PositionAmountHarness />);

    expect(app.container.querySelector("output")?.textContent).toBe("0");
    await act(async () => app.container.querySelector("button")?.click());
    expect(app.container.querySelector("output")?.textContent).toBe("5");
  });
});
