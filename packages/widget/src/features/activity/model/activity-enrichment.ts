import { Array as EArray } from "effect";
import type { YieldAction } from "../../../domain/action/models";
import { getActionValidatorAddresses } from "../../../domain/action/rules";
import type { Market } from "../../../domain/borrow/catalog/market";
import type { BorrowToken } from "../../../domain/borrow/catalog/token";
import type { BorrowActivityAction } from "../../../domain/borrow/responses";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/earn/models";
import type {
  ValidatorAddress,
  YieldId,
} from "../../../domain/identity/identifiers";
import type { WalletScopeKey } from "../../../domain/wallet/wallet-scope";
import type { ActivityHistoryEntry } from "../../../resources/activity-history/index";
import type { ActivityActionItem, YieldActivityItem } from "./activity-action";

/** Facts resolved for a set of Activity rows; missing facts stay absent. */
export type ActivityEnrichmentFacts = {
  readonly borrowMarketsById: ReadonlyMap<string, Market>;
  readonly validatorsByKey: ReadonlyMap<string, EarnValidator>;
  readonly yieldsById: ReadonlyMap<YieldId, EarnYieldWithProvider | null>;
};

export const validatorFactKey = ({
  address,
  yieldId,
}: {
  readonly address: ValidatorAddress;
  readonly yieldId: YieldId;
}) => JSON.stringify([yieldId, address]);

const BORROW_DEBT_ACTIONS: Record<BorrowActivityAction["action"], boolean> = {
  borrow: true,
  disableCollateral: false,
  enableCollateral: false,
  repay: true,
  supply: false,
  supplyAndBorrow: true,
  withdraw: false,
};

/** Borrow actions name a token by address; the market catalog names it. */
const resolveBorrowActivityToken = (
  action: BorrowActivityAction,
  market: Market | undefined
): BorrowToken | null => {
  if (!market) return null;

  const tokenAddress = action.rawArguments?.tokenAddress?.toLowerCase();
  if (tokenAddress) {
    const tokens = [
      market.loanToken,
      ...market.collateralTokens.map((collateral) => collateral.token),
    ];

    return (
      tokens.find((token) => token.address?.toLowerCase() === tokenAddress) ??
      null
    );
  }
  if (BORROW_DEBT_ACTIONS[action.action]) return market.loanToken;
  // Pool markets list every collateral, so only an isolated market implies one.
  if (market.type === "isolated") {
    return market.collateralTokens[0]?.token ?? null;
  }
  return null;
};

/** The one join of a Yield action with its yield and validator facts. */
export const projectYieldActivityItem = (
  action: YieldAction,
  walletScope: WalletScopeKey,
  { validatorsByKey, yieldsById }: ActivityEnrichmentFacts
): YieldActivityItem => ({
  _tag: "yield",
  actionData: action,
  validatorsData: EArray.flatMap(
    getActionValidatorAddresses(action) ?? [],
    (address) => {
      const validator = validatorsByKey.get(
        validatorFactKey({ address, yieldId: action.yieldId })
      );

      return validator ? [validator] : [];
    }
  ),
  walletScope,
  yieldData: yieldsById.get(action.yieldId) ?? null,
});

export const projectActivityActionItem = (
  entry: ActivityHistoryEntry,
  walletScope: WalletScopeKey,
  facts: ActivityEnrichmentFacts
): ActivityActionItem =>
  entry._tag === "yield"
    ? projectYieldActivityItem(entry.action, walletScope, facts)
    : {
        _tag: "borrow",
        actionData: entry.action,
        token: resolveBorrowActivityToken(
          entry.action,
          facts.borrowMarketsById.get(entry.action.rawArguments?.marketId ?? "")
        ),
        walletScope,
      };
