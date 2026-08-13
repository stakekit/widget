import { Schema } from "effect";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { EarnBalance } from "../../src/domain/earn/models";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { PositionDetailsWorkflowKey } from "../../src/features/position-details/state/workflow";
import { useValidatorAddressesHandling } from "../../src/features/position-details/ui/classic/hooks/use-validator-addresses-handling";
import { WalletScopeKey } from "../../src/services/wallet/wallet-scope";
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
const refreshedScopeA = new WalletScopeKey({
  additionalAddresses: { binanceBeaconAddress: "bnb-refreshed" },
  address: scopeA.address,
  network: scopeA.network,
});
const yieldDto = yieldApiYieldFixture();
const yieldBalance = Schema.decodeUnknownSync(EarnBalance)(
  yieldBalanceFixture({
    address: scopeA.address,
    pendingActions: [
      {
        arguments: {
          fields: [
            {
              label: "Validator",
              name: "validatorAddress",
              required: true,
              type: "address",
            },
          ],
        },
        intent: "manage",
        passthrough: "wallet-a-action",
        type: "CLAIM_REWARDS",
      },
    ],
    token: yieldDto.token,
  })
);
const pendingAction = yieldBalance.pendingActions[0]!;

const ValidatorModalHarness = ({
  scope,
}: {
  readonly scope: WalletScopeKey;
}) => {
  const modal = useValidatorAddressesHandling(
    new PositionDetailsWorkflowKey({
      balanceId: null,
      integrationId: null,
      pendingActionType: null,
      scope,
    })
  );

  return (
    <>
      <output data-testid="modal-state">
        {modal.showValidatorsModal ? "open" : "closed"}
      </output>
      <output data-testid="payload">
        {modal.showValidatorsModal ? modal.pendingAction?.passthrough : "none"}
      </output>
      <button
        onClick={() =>
          modal.openModal({ pendingAction: pendingAction, yieldBalance })
        }
        type="button"
      >
        Open validator selection
      </button>
    </>
  );
};

describe("position action wallet ownership", () => {
  it("closes a validator-required pending action when its wallet owner changes", async () => {
    const app = await render(<ValidatorModalHarness scope={scopeA} />);

    await act(async () =>
      app.container.querySelector<HTMLButtonElement>("button")?.click()
    );
    expect(
      app.container.querySelector('[data-testid="modal-state"]')?.textContent
    ).toBe("open");
    expect(
      app.container.querySelector('[data-testid="payload"]')?.textContent
    ).toBe("wallet-a-action");

    await app.rerender(<ValidatorModalHarness scope={scopeB} />);

    expect(
      app.container.querySelector('[data-testid="modal-state"]')?.textContent
    ).toBe("closed");
    expect(
      app.container.querySelector('[data-testid="payload"]')?.textContent
    ).toBe("none");
  });

  it("keeps validator selection open when only additional addresses refresh", async () => {
    const app = await render(<ValidatorModalHarness scope={scopeA} />);

    await act(async () =>
      app.container.querySelector<HTMLButtonElement>("button")?.click()
    );
    await app.rerender(<ValidatorModalHarness scope={refreshedScopeA} />);

    expect(
      app.container.querySelector('[data-testid="modal-state"]')?.textContent
    ).toBe("open");
    expect(
      app.container.querySelector('[data-testid="payload"]')?.textContent
    ).toBe("wallet-a-action");
  });
});
