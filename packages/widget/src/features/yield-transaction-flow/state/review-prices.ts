import {
  getTokensPricesRequest,
  PricesKey,
} from "../../../resources/token-prices/index";
import type { YieldTransactionFlowIntake } from "../model/intake";
import { getYieldTransactionFlowReviewPricingInput } from "../model/pricing";

/**
 * The prices request Review makes for `intake`. Steps reads the same key, so
 * its details usually find the prices already loaded.
 */
export const getYieldFlowReviewPricesKey = (
  intake: YieldTransactionFlowIntake
) => {
  const pricingInput = getYieldTransactionFlowReviewPricingInput(intake);
  return new PricesKey({
    request: pricingInput
      ? getTokensPricesRequest({
          token: pricingInput.token,
          yieldDto: pricingInput.yield,
        })
      : null,
  });
};
