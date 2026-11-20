import { Result, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { toPendingActionDeepLinkObservation } from "../../../src/app/routes/state/pending-action-deep-link-route";
import { preparePendingActionCommand } from "../../../src/domain/action/action-command";
import { EarnBalance } from "../../../src/domain/earn/balance";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { getPositionBalanceDataKey } from "../../../src/domain/portfolio/positions";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import {
  confidentialFixture,
  confidentialYieldFixture,
  yieldBalanceFixture,
} from "../../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const walletScope = new WalletScopeKey({
  address,
  network: "ethereum-sepolia",
});

describe("pending-action deep link route", () => {
  it("starts Manage on an encrypted balance hidden, with the handle to decrypt", () => {
    const handle = `0x${"cd".repeat(32)}`;
    const integration = confidentialYieldFixture();
    const balance = Schema.decodeSync(EarnBalance)(
      yieldBalanceFixture({
        address,
        amount: "0",
        amountRaw: "0",
        isEncrypted: true,
        pendingActions: [
          { intent: "manage", passthrough: "withdraw", type: "WITHDRAW" },
        ],
        shareAmount: "0",
        shareAmountRaw: handle,
        shareToken: confidentialFixture.cShare,
        token: confidentialFixture.cUsdc,
        type: "withdrawable",
      })
    );
    const pendingAction = balance.pendingActions[0]!;
    const prepared = Result.getOrThrow(
      preparePendingActionCommand({
        additionalAddresses: null,
        address,
        integration,
        pendingAction,
        pendingActionsState: new Map(),
        selectedValidators: [],
        yieldBalance: balance,
      })
    );

    const observation = toPendingActionDeepLinkObservation({
      balance,
      balanceId: getPositionBalanceDataKey(balance),
      // The intent only keys the coordinator's claim; its class is private.
      intentId: {
        address,
        balanceId: null,
        network: walletScope.network,
        pendingAction: "WITHDRAW",
        validator: null,
        yieldId: integration.id,
      } as never,
      pendingAction: prepared,
      providersDetails: [],
      type: "review",
      walletScope,
      yieldOp: integration,
    });

    expect(observation._tag).toBe("StartYieldFlow");
    expect(
      observation._tag === "StartYieldFlow" ? observation.input.intake : null
    ).toMatchObject({
      _tag: "Manage",
      balanceHidden: true,
      confidentialHandle: handle,
    });
  });
});
