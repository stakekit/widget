import { Context, type Effect } from "effect";
import type {
  ActionCommand,
  ActionTransaction,
  ManageActionCommand,
  SubmitSignedTransactionCommand,
  SubmitTransactionHashCommand,
  TransactionStatusCommand,
  YieldAction,
} from "../../domain/action/models";
import type { BorrowFeatureDisabled } from "../../domain/borrow/availability";
import type { Action as BorrowAction } from "../../domain/borrow/execution/action";
import type { ActionCommand as BorrowActionCommand } from "../../domain/borrow/execution/action-command";
import type {
  SubmitTransactionCommand as BorrowSubmitTransactionCommand,
  SubmitTransactionResult as BorrowSubmitTransactionResult,
} from "../../domain/borrow/execution/transaction";
import type {
  ApiRequestError,
  InputValidationError,
  MissingBorrowApiConfig,
  ResponseDecodeError,
} from "./resource-sources";

export type ActionPreviewRequest =
  | {
      readonly intent: "enter" | "exit";
      readonly command: ActionCommand;
    }
  | {
      readonly intent: "manage";
      readonly command: ManageActionCommand;
    };

type ApiOperationFailure = ApiRequestError | ResponseDecodeError;
type BorrowOperationFailure =
  | ApiOperationFailure
  | BorrowFeatureDisabled
  | MissingBorrowApiConfig;

type BorrowOperationsService = {
  readonly executeAction: (
    command: BorrowActionCommand
  ) => Effect.Effect<BorrowAction, BorrowOperationFailure>;
  readonly getAction: (
    actionId: string
  ) => Effect.Effect<BorrowAction | null, BorrowOperationFailure>;
  readonly stepAction: (
    actionId: string
  ) => Effect.Effect<BorrowAction, BorrowOperationFailure>;
  readonly submitTransaction: (request: {
    readonly command: BorrowSubmitTransactionCommand;
    readonly transactionId: string;
  }) => Effect.Effect<BorrowSubmitTransactionResult, BorrowOperationFailure>;
};

type YieldOperationsService = {
  readonly getTransactionStatus: (
    command: TransactionStatusCommand
  ) => Effect.Effect<ActionTransaction, ApiOperationFailure>;
  readonly previewAction: (
    request: ActionPreviewRequest
  ) => Effect.Effect<YieldAction, ApiOperationFailure | InputValidationError>;
  readonly submitSignedTransaction: (
    command: SubmitSignedTransactionCommand
  ) => Effect.Effect<ActionTransaction, ApiOperationFailure>;
  readonly submitTransactionHash: (
    command: SubmitTransactionHashCommand
  ) => Effect.Effect<ActionTransaction, ApiOperationFailure>;
};

export class BorrowOperations extends Context.Service<
  BorrowOperations,
  BorrowOperationsService
>()("stakekit/widget/services/api/BorrowOperations") {}

export class YieldOperations extends Context.Service<
  YieldOperations,
  YieldOperationsService
>()("stakekit/widget/services/api/YieldOperations") {}
