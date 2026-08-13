import { Cause, Effect, Layer, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import {
  YieldHistoryResourceKey,
  YieldInsightError,
  YieldKycStatusKey,
  yieldKycStatusResourceAtom,
  yieldRewardRateHistoryResourceAtom,
  yieldTvlHistoryResourceAtom,
} from "../../src/resources/yield-insights/yield-insights";
import { ApiRequestError } from "../../src/services/api/api-errors";
import { YieldResourceSource } from "../../src/services/api/yield-resource-source";
import { yieldApiYieldFixture } from "../fixtures";

const yieldId = yieldApiYieldFixture().id;
const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const otherAddress = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000002"
);

const makeRegistry = (source: YieldResourceSource["Service"]) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.succeed(YieldResourceSource, source)
      ),
    ],
  });

describe("Yield insight resources", () => {
  it("shares exact KYC owners and separates wallet addresses", () => {
    const getKycStatus = vi.fn(() =>
      Effect.succeed({ kycStatus: "approved" as const })
    );
    const registry = makeRegistry(
      YieldResourceSource.of({ getKycStatus } as never)
    );
    const key = new YieldKycStatusKey({ address, yieldId });

    registry.get(yieldKycStatusResourceAtom(key));
    registry.get(
      yieldKycStatusResourceAtom(new YieldKycStatusKey({ address, yieldId }))
    );
    registry.get(
      yieldKycStatusResourceAtom(
        new YieldKycStatusKey({ address: otherAddress, yieldId })
      )
    );

    expect(getKycStatus).toHaveBeenCalledTimes(2);
  });

  it("uses Yield, period, and interval as complete history identity", () => {
    const getRewardRateHistory = vi.fn(() => Effect.succeed({} as never));
    const getTvlHistory = vi.fn(() => Effect.succeed({} as never));
    const registry = makeRegistry(
      YieldResourceSource.of({
        getRewardRateHistory,
        getTvlHistory,
      } as never)
    );
    const daily = new YieldHistoryResourceKey({
      interval: "day",
      period: "30d",
      yieldId,
    });
    const weekly = new YieldHistoryResourceKey({
      interval: "week",
      period: "1y",
      yieldId,
    });

    registry.get(yieldRewardRateHistoryResourceAtom(daily));
    registry.get(yieldRewardRateHistoryResourceAtom(daily));
    registry.get(yieldRewardRateHistoryResourceAtom(weekly));
    registry.get(yieldTvlHistoryResourceAtom(daily));
    registry.get(yieldTvlHistoryResourceAtom(weekly));

    expect(getRewardRateHistory).toHaveBeenCalledTimes(2);
    expect(getTvlHistory).toHaveBeenCalledTimes(2);
  });

  it("publishes typed KYC failure and retries the same owner", () => {
    let offline = true;
    const requestError = new ApiRequestError({
      cause: new Error("offline"),
      operation: "yield-kyc-status",
    });
    const getKycStatus = vi.fn(() =>
      offline
        ? Effect.fail(requestError)
        : Effect.succeed({ kycStatus: "approved" as const })
    );
    const registry = makeRegistry(
      YieldResourceSource.of({ getKycStatus } as never)
    );
    const key = new YieldKycStatusKey({ address, yieldId });
    const resource = yieldKycStatusResourceAtom(key);
    const failed = registry.get(resource);

    expect(AsyncResult.isFailure(failed)).toBe(true);
    if (!AsyncResult.isFailure(failed)) throw new Error("Expected failure");
    expect(
      Option.getOrThrow(Cause.findErrorOption(failed.cause))
    ).toBeInstanceOf(YieldInsightError);

    const attemptsBeforeRetry = getKycStatus.mock.calls.length;
    offline = false;
    registry.refresh(resource);
    expect(AsyncResult.getOrThrow(registry.get(resource))).toEqual({
      kycStatus: "approved",
    });
    expect(getKycStatus).toHaveBeenCalledTimes(attemptsBeforeRetry + 1);
  });
});
