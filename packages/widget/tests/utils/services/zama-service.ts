import { Effect, Layer } from "effect";
import { RevealedBalances } from "../../../src/services/zama/revealed-balances";
import { ZamaService } from "../../../src/services/zama/zama-service";

const unexpected = <A>(method: string): Effect.Effect<A> =>
  Effect.die(`test ZamaService: unexpected call to ${method}`);

export const makeTestZamaLayer = (
  overrides: Partial<ZamaService["Service"]> = {}
) =>
  Layer.merge(
    RevealedBalances.layer,
    Layer.succeed(
      ZamaService,
      ZamaService.of({
        planConversion: () => unexpected("planConversion"),
        decryptCommand: () => unexpected("decryptCommand"),
        encryptCommand: () => unexpected("encryptCommand"),
        revealHandles: () => unexpected("revealHandles"),
        revealTokenBalance: () => unexpected("revealTokenBalance"),
        ...overrides,
      })
    )
  );
