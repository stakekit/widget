import { Effect, Ref } from "effect";

import {
  type DirectTransaction,
  getDirectTransactionFallbackGas,
} from "../../../domain/action/direct-transaction";
import type { YieldAction } from "../../../domain/earn/action-models";
import {
  type ConfidentialPreparation,
  getConfidentialOperatorGrants,
  getConfidentialPlannedSteps,
} from "../../../domain/earn/confidential-vault";
import { fromBaseUnits } from "../../../domain/finance/base-units";
import { exactZero } from "../../../domain/finance/exact";
import type { Token } from "../../../domain/token/token";
import type {
  ActionPreviewRequest,
  YieldOperations,
} from "../../../services/api/operations";
import { EvmRpc } from "../../../services/evm-rpc/evm-rpc";
import { prepareConfidentialCommand } from "../../../services/zama/confidential-preparation";
import { ZamaService } from "../../../services/zama/zama-service";
import { getYieldFlowConfidentialPreparation } from "../model/confidential-preparation";
import type { YieldTransactionFlowIntake } from "../model/intake";
import type {
  YieldFlowExecutionSource,
  YieldFlowSession,
} from "../model/session";

/**
 * The approve and wrap a confidential deposit of the underlying token needs,
 * planned when the user confirms so Steps lists them at once. Once the wrap
 * was sent it spent what the approvals set, so what was sent is resumed
 * without reading the allowance again.
 */
const planConversion = Effect.fn("planConfidentialConversion")(function* (
  session: YieldFlowSession,
  preparation: ConfidentialPreparation
) {
  if (preparation._tag !== "Encrypt" || !preparation.conversion) return [];
  const sent = [...(yield* Ref.get(session.ledger)).values()].map(
    ({ transaction }) => transaction
  );
  if (sent.some(({ type }) => type === "WRAP")) return sent;
  const zama = yield* ZamaService;
  return yield* zama.planConversion({
    amount: preparation.amount,
    conversion: preparation.conversion,
    network: preparation.yieldDto.network,
    owner: preparation.command.address,
  });
});

/**
 * The approve and wrap a confidential deposit of the underlying token still
 * needs: what the Session already sent is left out. Nothing for any other
 * action.
 */
const planPendingConfidentialConversion = Effect.fn(
  "planPendingConfidentialConversion"
)(function* (session: YieldFlowSession, preparation: ConfidentialPreparation) {
  const sent = yield* Ref.get(session.ledger);
  return (yield* planConversion(session, preparation)).filter(
    ({ id }) => !sent.has(id)
  );
});

/**
 * What the transactions around a confidential action cost, in the gas token:
 * the approve and wrap a deposit of the underlying token still needs. Null
 * when it cannot be estimated, as for an Instant Exit, whose finishing
 * withdrawal only exists once its unwrap confirms, or when the gas token is
 * not the chain's native one the node prices fees in.
 */
const estimateConfidentialConversionGas = Effect.fn(
  "estimateConfidentialConversionGas"
)(
  function* (
    preparation: ConfidentialPreparation,
    pending: ReadonlyArray<DirectTransaction>,
    gasFeeToken: Token
  ) {
    if (preparation._tag === "Encrypt" && preparation.instant) return null;
    if (preparation._tag !== "Encrypt" || !preparation.conversion) {
      return exactZero();
    }
    if (pending.length === 0) return exactZero();
    if (gasFeeToken.address !== undefined) return null;
    const evmRpc = yield* EvmRpc;
    const fee = yield* evmRpc.estimateFee({
      chainId: preparation.conversion.chainId,
      from: preparation.command.address,
      transactions: pending.map((transaction, position) => ({
        data: transaction.data,
        fallbackGas: getDirectTransactionFallbackGas(transaction, position),
        to: transaction.to,
      })),
    });
    return fromBaseUnits(fee, gasFeeToken.decimals);
  },
  (effect) =>
    effect.pipe(
      Effect.catch((cause) =>
        Effect.logWarning("Review could not estimate the conversion gas.").pipe(
          Effect.annotateLogs({ cause }),
          Effect.as(null)
        )
      )
    )
);

/**
 * The Planned Steps Steps lists until the prepared action returns them. A
 * private exit's operator grants are read when the user confirms, as the API
 * reads them when it builds the action.
 */
const readPlannedSteps = Effect.fn("readConfidentialPlannedSteps")(function* (
  preparation: ConfidentialPreparation
) {
  const operators = getConfidentialOperatorGrants(preparation);
  const missingOperatorGrants = operators
    ? yield* ZamaService.use((zama) =>
        zama.countMissingOperatorGrants({
          ...operators,
          owner: preparation.command.address,
        })
      )
    : 0;
  return getConfidentialPlannedSteps(preparation, { missingOperatorGrants });
});

/**
 * What Steps runs for a Confidential Vault, planned when the user confirms
 * so Steps lists every step at once, with the action Review prepared.
 */
const planConfidentialHandoff = Effect.fn("planConfidentialHandoff")(function* (
  session: YieldFlowSession,
  preparation: ConfidentialPreparation,
  prepared: YieldAction | null
) {
  return {
    _tag: "Prepare",
    conversion: yield* planConversion(session, preparation),
    preparation,
    prepared,
    plannedStepTypes: yield* readPlannedSteps(preparation),
  } satisfies YieldFlowExecutionSource;
});

/**
 * A confidential vault's action, its amount encrypted or decrypted without
 * asking the wallet anything, then previewed, so Review shows its gas and
 * Steps runs it. Null when it cannot be created now: Steps then prepares it
 * itself, so Confirm stays possible.
 */
const prepareConfidentialAction = Effect.fn("prepareConfidentialAction")(
  function* <E>(
    preparation: ConfidentialPreparation,
    preview: (
      request: ActionPreviewRequest
    ) => Effect.Effect<YieldAction, E, YieldOperations>
  ) {
    const zama = yield* ZamaService;
    const request = yield* prepareConfidentialCommand(zama, preparation);
    return yield* preview(request);
  },
  (effect) =>
    effect.pipe(
      Effect.catch((cause) =>
        Effect.logWarning(
          "Review could not prepare the confidential action."
        ).pipe(Effect.annotateLogs({ cause }), Effect.as(null))
      )
    )
);

/**
 * What Review does for a confidential vault's action, which it prepares
 * instead of previewing: create the action ahead of Steps, plan and price the
 * conversion a deposit of the underlying token runs first, and plan Steps on
 * Confirm. Null outside a confidential vault, and for an Activity
 * continuation, which resumes an action already created.
 */
export const getYieldFlowConfidentialReview = (
  intake: YieldTransactionFlowIntake
) => {
  const preparation = getYieldFlowConfidentialPreparation(intake);
  if (!preparation) return null;
  return {
    prepareAction: <E>(
      preview: (
        request: ActionPreviewRequest
      ) => Effect.Effect<YieldAction, E, YieldOperations>
    ) => prepareConfidentialAction(preparation, preview),
    planPendingConversion: (session: YieldFlowSession) =>
      planPendingConfidentialConversion(session, preparation),
    estimateConversionGas: (
      pending: ReadonlyArray<DirectTransaction>,
      gasFeeToken: Token
    ) => estimateConfidentialConversionGas(preparation, pending, gasFeeToken),
    planHandoff: (session: YieldFlowSession, prepared: YieldAction | null) =>
      planConfidentialHandoff(session, preparation, prepared),
  } as const;
};
