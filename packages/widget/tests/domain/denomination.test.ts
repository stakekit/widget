import { describe, expect, it } from "@effect/vitest";
import BigNumber from "bignumber.js";
import { Schema } from "effect";
import {
  getBalanceShares,
  getExitAmountToken,
  getExitUnit,
  getPendingActionReturn,
  getPositionShares,
} from "../../src/domain/earn/denomination";
import {
  ConfidentialHandle,
  type EarnBalance,
} from "../../src/domain/earn/models";
import { Token } from "../../src/domain/token/token";
import {
  confidentialFixture,
  confidentialYieldFixture,
  yieldApiYieldDtoFixture,
  yieldApiYieldFixture,
} from "../fixtures";

const decodeToken = Schema.decodeSync(Token);
const usdc = decodeToken(confidentialFixture.usdc);
const cUsdc = decodeToken(confidentialFixture.cUsdc);
const cShare = decodeToken(confidentialFixture.cShare);
const steakUsdc = decodeToken({
  ...confidentialFixture.cShare,
  address: "0xabababababababababababababababababababab",
  symbol: "steakUSDC",
});
const handle = Schema.decodeSync(ConfidentialHandle)(`0x${"ab".repeat(32)}`);

type ExitFieldName = "amount" | "shareAmount" | "shareAmountRaw";

const field = (name: ExitFieldName) => ({
  label: name,
  minimum: "0",
  name,
  required: name === "amount",
  type: "string" as const,
});

const yieldWithExitFields = (names: ReadonlyArray<ExitFieldName>) =>
  yieldApiYieldFixture({
    mechanics: {
      ...yieldApiYieldDtoFixture().mechanics,
      arguments: { enter: { fields: [] }, exit: { fields: names.map(field) } },
    },
    outputToken: confidentialFixture.cShare,
    token: confidentialFixture.usdc,
    tokens: [confidentialFixture.usdc],
  });

describe("denomination", () => {
  it("shows Shares only when they are not the Value Token and are visible", () => {
    const shares = getBalanceShares({
      shares: { _tag: "Plain", amount: new BigNumber("100") },
      shareToken: steakUsdc,
      token: usdc,
    });
    expect(shares?.amount.toFixed()).toBe("100");
    expect(shares?.token.symbol).toBe("steakUSDC");

    expect(getBalanceShares({ token: usdc })).toBeNull();
    expect(
      getBalanceShares({
        shares: { _tag: "Plain", amount: new BigNumber("2") },
        shareToken: cUsdc,
        token: cUsdc,
      })
    ).toBeNull();
    expect(
      getBalanceShares({
        shares: { _tag: "Encrypted", handle },
        shareToken: cShare,
        token: usdc,
      })
    ).toBeNull();
  });

  it("exits in Shares only for an encrypted shares contract whose balances all hold shares", () => {
    const withShare = [{ shareToken: cShare }];

    expect(getExitUnit(confidentialYieldFixture(), withShare)).toBe("shares");
    expect(getExitUnit(yieldApiYieldFixture(), withShare)).toBe("value");
    // A plain share-only contract is a request shape the widget cannot build.
    expect(getExitUnit(yieldWithExitFields(["shareAmount"]), withShare)).toBe(
      "value"
    );
    expect(
      getExitUnit(yieldWithExitFields(["shareAmountRaw"]), withShare)
    ).toBe("value");
    // ERC-4626 vaults take a plain amount beside optional shares.
    expect(
      getExitUnit(yieldWithExitFields(["amount", "shareAmount"]), withShare)
    ).toBe("value");
    expect(getExitUnit(confidentialYieldFixture(), [{}])).toBe("value");
    expect(getExitUnit(confidentialYieldFixture(), [])).toBe("value");
  });

  it("labels an exit action's amount with the output token only when the exit takes only shares", () => {
    expect(getExitAmountToken(confidentialYieldFixture()).symbol).toBe(
      cShare.symbol
    );
    expect(
      getExitAmountToken(yieldWithExitFields(["amount", "shareAmount"])).symbol
    ).toBe(usdc.symbol);
    expect(
      getExitAmountToken(yieldWithExitFields(["shareAmount"])).symbol
    ).toBe(usdc.symbol);
  });

  it("returns the committed Shares for a cancel and nothing for other pending actions", () => {
    const exiting = {
      shares: { _tag: "Plain", amount: new BigNumber("0.097168") } as const,
      shareToken: cShare,
      token: usdc,
    };
    const refund = getPendingActionReturn("CANCEL_PENDING", exiting);

    expect(refund?.token.symbol).toBe(cShare.symbol);
    expect(refund?.amount.toFixed()).toBe("0.097168");
    expect(getPendingActionReturn("CLAIM_REWARDS", exiting)).toBeNull();
    expect(
      getPendingActionReturn("CANCEL_PENDING", { token: usdc })
    ).toBeNull();
  });

  it("returns nothing for a cancel whose shares are the Value Token itself", () => {
    expect(
      getPendingActionReturn("CANCEL_PENDING", {
        shares: { _tag: "Plain", amount: new BigNumber("2") },
        shareToken: cUsdc,
        token: cUsdc,
      })
    ).toBeNull();
  });

  it("derives a cancel's share amount from its base units, and counts hidden shares as zero", () => {
    expect(
      getPendingActionReturn("CANCEL_PENDING", {
        shares: { _tag: "Plain", amountRaw: 97168n },
        shareToken: cShare,
        token: usdc,
      })?.amount.toFixed()
    ).toBe("0.097168");
    expect(
      getPendingActionReturn("CANCEL_PENDING", {
        shares: { _tag: "Encrypted", handle },
        shareToken: cShare,
        token: usdc,
      })?.amount.toFixed()
    ).toBe("0");
    // A plain vault without a share count shows no "0 <share>".
    expect(
      getPendingActionReturn("CANCEL_PENDING", {
        shareToken: steakUsdc,
        token: usdc,
      })
    ).toBeNull();
  });
});

describe("position shares", () => {
  const plain = (amount: string) =>
    ({ _tag: "Plain", amount: new BigNumber(amount) }) as const;
  const vaultShare = (
    amount: string,
    shares: string,
    type: EarnBalance["type"] = "active"
  ) => ({
    amount: new BigNumber(amount),
    amountUsd: new BigNumber(amount),
    shares: plain(shares),
    shareToken: steakUsdc,
    token: usdc,
    type,
  });
  const valued = (
    amount: string,
    token: Token = usdc,
    type: EarnBalance["type"] = "withdrawable"
  ) => ({
    amount: new BigNumber(amount),
    amountUsd: new BigNumber(amount),
    token,
    type,
  });
  const summarize = (shares: ReturnType<typeof getPositionShares>) =>
    shares?._tag === "Visible"
      ? {
          amountUsd: shares.amountUsd?.toFixed() ?? null,
          groups: shares.groups.map((group) => ({
            amount: group.amount.toFixed(),
            symbol: group.token.symbol,
          })),
        }
      : shares;

  it("groups a vault's shares and values them by the balances carrying them", () => {
    expect(summarize(getPositionShares([vaultShare("110", "100")]))).toEqual({
      amountUsd: "110",
      groups: [{ amount: "100", symbol: "steakUSDC" }],
    });
  });

  it("leaves Value Token balances out", () => {
    expect(
      summarize(getPositionShares([vaultShare("110", "100"), valued("5")]))
    ).toEqual({
      amountUsd: "110",
      groups: [{ amount: "100", symbol: "steakUSDC" }],
    });
  });

  it("sums revealed vault shares across balances, apart from same-token wrappers", () => {
    expect(
      summarize(
        getPositionShares([
          { ...vaultShare("2", "1.5"), shareToken: cShare },
          { ...vaultShare("1", "0.75", "exiting"), shareToken: cShare },
          {
            amount: new BigNumber("3"),
            amountUsd: new BigNumber("3"),
            shares: plain("3"),
            shareToken: cUsdc,
            token: cUsdc,
            type: "entering",
          },
        ])
      )
    ).toEqual({
      amountUsd: "3",
      groups: [{ amount: "2.25", symbol: cShare.symbol }],
    });
  });

  it("has no USD value unless every balance carrying shares is priced", () => {
    expect(
      summarize(
        getPositionShares([
          vaultShare("110", "100"),
          { ...vaultShare("1", "0.75", "exiting"), amountUsd: null },
        ])
      )
    ).toEqual({
      amountUsd: null,
      groups: [{ amount: "100.75", symbol: "steakUSDC" }],
    });
  });

  it("has no Shares when every balance holds its Value Token", () => {
    expect(getPositionShares([valued("1")])).toBeNull();
  });

  it("is hidden while shares in another token are encrypted", () => {
    expect(
      getPositionShares([
        {
          amount: new BigNumber("0"),
          amountUsd: null,
          shares: { _tag: "Encrypted", handle },
          shareToken: cShare,
          token: usdc,
          type: "active",
        },
        { ...vaultShare("1", "0.75"), shareToken: cShare },
      ])
    ).toEqual({ _tag: "Hidden" });
  });

  it("is not hidden by encrypted shares of the Value Token itself", () => {
    expect(
      summarize(
        getPositionShares([
          vaultShare("110", "100"),
          {
            amount: new BigNumber("0"),
            amountUsd: null,
            shares: { _tag: "Encrypted", handle },
            shareToken: cUsdc,
            token: cUsdc,
            type: "entering",
          },
        ])
      )
    ).toEqual({
      amountUsd: "110",
      groups: [{ amount: "100", symbol: "steakUSDC" }],
    });
  });

  it("leaves points and unclaimed rewards out", () => {
    const points = decodeToken({
      ...confidentialFixture.usdc,
      isPoints: true,
      symbol: "PTS",
    });
    expect(
      summarize(
        getPositionShares([
          vaultShare("110", "100"),
          { ...vaultShare("7", "7"), token: points },
          vaultShare("3", "2", "claimable"),
        ])
      )
    ).toEqual({
      amountUsd: "110",
      groups: [{ amount: "100", symbol: "steakUSDC" }],
    });
  });
});
