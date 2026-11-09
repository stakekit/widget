import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { appRuntime } from "../../../runtime/app-runtime";
import type { RichError } from "../../../services/errors/rich-error";
import {
  type RichErrorRetry,
  RichErrorService,
} from "../../../services/errors/rich-error-service";

export const richErrorAtom = appRuntime.subscriptionRef(
  Effect.map(RichErrorService, ({ current }) => current)
);

const richErrorRetryAtom = appRuntime.subscriptionRef(
  Effect.map(RichErrorService, ({ retry }) => retry)
);

/** The Rich Error shown, and how to run its work again; nulls until known. */
export const richErrorViewAtom = Atom.make(
  (
    get
  ): {
    readonly error: RichError | null;
    readonly retryWith: RichErrorRetry | null;
  } => ({
    error: AsyncResult.getOrElse(get(richErrorAtom), () => null),
    retryWith: AsyncResult.getOrElse(get(richErrorRetryAtom), () => null),
  })
).pipe(Atom.withLabel("richErrorViewAtom"));
