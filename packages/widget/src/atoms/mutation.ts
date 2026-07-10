import { Effect, Schema, type Scope } from "effect";
import type * as Atom from "effect/unstable/reactivity/Atom";
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import type * as Reactivity from "effect/unstable/reactivity/Reactivity";
import {
  invalidateAtomResources,
  withApiRequestError,
  withResponseDecodeError,
} from "./api-resource";

/**
 * Builds an explicitly triggered mutation atom. Each write performs exactly one
 * transport attempt, strictly decodes the single response with Effect Schema,
 * and refreshes only the resources declared after a successful decode.
 */
export const makeStrictApiMutation = <
  Services,
  RuntimeError,
  Command,
  RawResponse,
  RequestError,
  ResponseSchema extends Schema.ConstraintDecoder<unknown>,
>(
  runtime: Atom.AtomRuntime<Services, RuntimeError>,
  options: {
    readonly concurrent?: boolean;
    readonly execute: (
      command: Command,
      context: Atom.FnContext
    ) => Effect.Effect<
      RawResponse,
      RequestError,
      Services | Scope.Scope | AtomRegistry.AtomRegistry | Reactivity.Reactivity
    >;
    readonly invalidates?: (
      command: Command,
      result: ResponseSchema["Type"]
    ) => ReadonlyArray<Atom.Atom<unknown>>;
    readonly operation: string;
    readonly responseSchema: ResponseSchema;
  }
) =>
  runtime.fn(
    (command: Command, context) =>
      options.execute(command, context).pipe(
        withApiRequestError(options.operation),
        Effect.flatMap((response) =>
          Schema.decodeUnknownEffect(options.responseSchema)(response).pipe(
            withResponseDecodeError(options.operation)
          )
        ),
        Effect.tap((result) =>
          Effect.sync(() => {
            const resources = options.invalidates?.(command, result) ?? [];
            invalidateAtomResources(context, resources);
          })
        )
      ),
    { concurrent: options.concurrent ?? false }
  );
