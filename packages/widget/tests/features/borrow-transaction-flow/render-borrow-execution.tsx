import { Effect } from "effect";
import { userEvent } from "vitest/browser";

import { render } from "../../utils/test-utils";
import {
  type ExecutionOptions,
  type BorrowApi,
  makeExecutionApp,
} from "./borrow-execution-harness";

/** Renders the Borrow flow in the browser and, by default, confirms Review. */
export const renderExecution = (
  borrow: BorrowApi,
  options: ExecutionOptions = {}
) =>
  Effect.gen(function* () {
    const element = yield* makeExecutionApp(borrow, options);
    const app = yield* Effect.acquireRelease(
      Effect.promise(() => render(element)),
      (app) => Effect.promise(() => app.unmount())
    );

    if (
      options.autoStart !== false &&
      options.initialPath !== "/borrow/complete"
    ) {
      yield* Effect.promise(() =>
        userEvent.click(app.getByTestId("start-execution"))
      );
    }

    return app;
  });
