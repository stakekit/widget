import { Effect, Layer } from "effect";
import { ConfidentialValues } from "../../../src/services/zama/confidential-values";
import { ZamaService } from "../../../src/services/zama/zama-service";

const unexpected = <A>(method: string): Effect.Effect<A> =>
  Effect.die(`test ZamaService: unexpected call to ${method}`);

export const makeTestZamaLayer = (
  overrides: Partial<ZamaService["Service"]> = {}
) =>
  Layer.merge(
    ConfidentialValues.layer,
    Layer.succeed(
      ZamaService,
      ZamaService.of({
        conversionSteps: () => unexpected("conversionSteps"),
        convertStep: () => unexpected("convertStep"),
        encrypt: () => unexpected("encrypt"),
        publicDecrypt: () => unexpected("publicDecrypt"),
        revealHandles: () => unexpected("revealHandles"),
        revealTokenBalance: () => unexpected("revealTokenBalance"),
        wrappedAmount: () => unexpected("wrappedAmount"),
        ...overrides,
      })
    )
  );
