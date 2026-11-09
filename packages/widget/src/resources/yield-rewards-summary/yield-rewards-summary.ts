import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";

import type { WalletAddress, YieldId } from "../../domain/identity/identifiers";
import { appRuntime } from "../../runtime/app-runtime";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../services/api/resource-sources";
import { YieldResourceSource } from "../../services/api/resource-sources";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

export class YieldRewardsSummaryKey extends Data.TaggedClass(
  "YieldRewardsSummaryKey"
)<{
  readonly address: WalletAddress;
  readonly yieldId: YieldId;
}> {}

export class YieldRewardsSummaryError extends Data.TaggedError(
  "YieldRewardsSummaryError"
)<{
  readonly cause: ApiRequestError | ResponseDecodeError;
}> {}

// The API caches a summary for 10 minutes and aggregates earnings hourly.
const rewardsSummaryPolicy = withApiResourcePolicy({
  staleTime: Duration.minutes(10),
});

const yieldRewardsSummaryCanonicalAtom = Atom.family(
  (key: YieldRewardsSummaryKey) =>
    appRuntime
      .atom(() =>
        YieldResourceSource.use((source) =>
          source.getRewardsSummary({
            address: key.address,
            yieldId: key.yieldId,
          })
        ).pipe(
          Effect.mapError((cause) => new YieldRewardsSummaryError({ cause }))
        )
      )
      .pipe(
        rewardsSummaryPolicy,
        Atom.withLabel("yieldRewardsSummaryResourceAtom")
      )
);

/**
 * A wallet's fixed-window earnings in a Yield, one request per wallet and
 * Yield; none when the API does not track the Yield's earnings.
 */
export const yieldRewardsSummaryResourceAtom = makePresentableResourceFamily(
  yieldRewardsSummaryCanonicalAtom
);
