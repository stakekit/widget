import { Schema } from "effect";
import * as YieldApi from "../../generated/api/yield-schema";
import { ActionId, TransactionId, WalletAddress, YieldId } from "./identifiers";
import { TolerantTopLevelArray } from "./response";
import { Network } from "./wallet-models";

const EarnTransaction = Schema.Struct({
  ...YieldApi.TransactionDto.fields,
  id: TransactionId,
  network: Network,
});

const EarnAction = Schema.Struct({
  ...YieldApi.ActionDto.fields,
  id: ActionId,
  yieldId: YieldId,
  address: WalletAddress,
  transactions: Schema.Array(EarnTransaction),
});

export const ActivityActionsPage = Schema.Struct({
  ...YieldApi.ActionsControllerGetActions200.fields,
  items: Schema.optionalKey(
    TolerantTopLevelArray(EarnAction, {
      operation: "activity-actions",
    })
  ),
});
export type ActivityActionsPage = typeof ActivityActionsPage.Type;
