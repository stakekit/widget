import { Context, type Effect, Option } from "effect";
import type {
  ActionCommand,
  ActionTransactionReceipt,
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
  ActionId as BorrowActionId,
  TransactionId as BorrowTransactionId,
} from "../../domain/borrow/ids";
import type { EarnYieldBalancesResponse } from "../../domain/earn/models";
import type { WalletAddress, YieldId } from "../../domain/identity/identifiers";
import {
  ApiFailure,
  type ApiRequestError,
  type InputValidationError,
  type MissingBorrowApiConfig,
  type ResponseDecodeError,
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
export type BorrowOperationFailure =
  | ApiOperationFailure
  | BorrowFeatureDisabled
  | MissingBorrowApiConfig;

type BorrowOperationsService = {
  readonly executeAction: (
    command: BorrowActionCommand
  ) => Effect.Effect<BorrowAction, BorrowOperationFailure>;
  readonly getAction: (
    actionId: BorrowActionId
  ) => Effect.Effect<BorrowAction | null, BorrowOperationFailure>;
  readonly stepAction: (
    actionId: BorrowActionId
  ) => Effect.Effect<BorrowAction, BorrowOperationFailure>;
  readonly submitTransaction: (request: {
    readonly command: BorrowSubmitTransactionCommand;
    readonly transactionId: BorrowTransactionId;
  }) => Effect.Effect<BorrowSubmitTransactionResult, BorrowOperationFailure>;
  /**
   * `submitTransaction` for work that outlives the user's Transaction Flow:
   * it never presents the failure as a Rich Error.
   */
  readonly submitTransactionInBackground: (request: {
    readonly command: BorrowSubmitTransactionCommand;
    readonly transactionId: BorrowTransactionId;
  }) => Effect.Effect<BorrowSubmitTransactionResult, BorrowOperationFailure>;
};

type YieldOperationsService = {
  /** A wallet's balances in one yield, read for a workflow in progress. */
  readonly getYieldBalances: (request: {
    readonly address: WalletAddress;
    readonly yieldId: YieldId;
  }) => Effect.Effect<EarnYieldBalancesResponse, ApiOperationFailure>;
  readonly getTransactionStatus: (
    command: TransactionStatusCommand
  ) => Effect.Effect<ActionTransactionReceipt, ApiOperationFailure>;
  readonly previewAction: (
    request: ActionPreviewRequest
  ) => Effect.Effect<YieldAction, ApiOperationFailure | InputValidationError>;
  readonly submitSignedTransaction: (
    command: SubmitSignedTransactionCommand
  ) => Effect.Effect<ActionTransactionReceipt, ApiOperationFailure>;
  readonly submitTransactionHash: (
    command: SubmitTransactionHashCommand
  ) => Effect.Effect<ActionTransactionReceipt, ApiOperationFailure>;
  /**
   * `submitTransactionHash` for work that outlives the user's Transaction
   * Flow: it never presents the failure as a Rich Error.
   */
  readonly submitTransactionHashInBackground: (
    command: SubmitTransactionHashCommand
  ) => Effect.Effect<ActionTransactionReceipt, ApiOperationFailure>;
};

export class BorrowOperations extends Context.Service<
  BorrowOperations,
  BorrowOperationsService
>()("stakekit/widget/services/api/BorrowOperations") {}

export class YieldOperations extends Context.Service<
  YieldOperations,
  YieldOperationsService
>()("stakekit/widget/services/api/YieldOperations") {}

const transientStatuses: ReadonlySet<number> = new Set([
  408, 429, 500, 502, 503, 504,
]);

/**
 * Whether repeating the request may succeed: it never reached the API, or the
 * API answered with a transient status. Every other failure, including an
 * unreadable response, is final.
 */
export const isTransientApiFailure = (
  error: BorrowOperationFailure | InputValidationError
): boolean =>
  error._tag === "ApiRequestError" &&
  ApiFailure.match(error.failure, {
    ErrorStatus: ({ status }) => transientStatuses.has(status),
    InvalidRequest: () => false,
    Unreachable: () => true,
    UnreadableResponse: () => false,
  });

/**
 * The API's own explanation when it refused a request: the message of a 4xx
 * response that carries one.
 */
export const getApiRejectionReason = (
  failure: ApiFailure
): Option.Option<string> =>
  failure._tag === "ErrorStatus" &&
  failure.status >= 400 &&
  failure.status < 500 &&
  failure.body !== null
    ? Option.some(failure.body.message)
    : Option.none();
