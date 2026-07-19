import { Data, Effect } from "effect";
import { appRuntime } from "../../../app/runtime/app-runtime";
import type { Action } from "../../../domain/borrow/action";
import type { ActionRequest } from "../../../domain/borrow/action-request";
import { BorrowApiService } from "../../../services/api/borrow-api-service";

class BorrowActionCreationError extends Data.TaggedError(
  "BorrowActionCreationError"
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

const terminalStatuses = new Set(["FAILED", "CANCELED", "STALE"]);

const validateCreatedAction = (action: Action) =>
  terminalStatuses.has(action.status)
    ? Effect.fail(
        new BorrowActionCreationError({
          message: `Borrow action ended with ${action.status} status.`,
        })
      )
    : Effect.succeed(action);

export const borrowCreateActionAtom = appRuntime.fn((request: ActionRequest) =>
  BorrowApiService.use((api) => api.executeAction(request)).pipe(
    Effect.mapError(
      (cause) =>
        new BorrowActionCreationError({
          cause,
          message: "Borrow action could not be created.",
        })
    ),
    Effect.flatMap(validateCreatedAction)
  )
);
