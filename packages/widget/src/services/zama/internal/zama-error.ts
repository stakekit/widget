import { Data, Effect } from "effect";
import { type Address, isAddress } from "viem";

export class ZamaError extends Data.TaggedError("ZamaError")<{
  readonly cause: unknown;
  readonly operation: string;
}> {}

// viem takes 0x addresses; an EVM wallet's and contract's addresses are in them.
export const toEvmAddress = (
  address: string,
  operation: string
): Effect.Effect<Address, ZamaError> =>
  isAddress(address, { strict: false })
    ? Effect.succeed(address)
    : Effect.fail(
        new ZamaError({ cause: `Not an EVM address: ${address}`, operation })
      );

export const tryZama = <A>(operation: string, run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => new ZamaError({ cause, operation }),
  });
