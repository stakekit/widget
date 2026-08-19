import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { EarnValidator } from "../../src/domain/earn/models";
import { resolveValidators } from "../../src/features/earn/state/earn-selection/model/validators";
import type { EarnEntry } from "../../src/features/earn/state/earn-selection/types";
import { yieldApiValidatorFixture } from "../fixtures";

const entry: EarnEntry = {
  categoryOrder: ["stake", "defi", "rwa"],
  dashboardVariant: false,
  initParams: null,
  preferredTokenYieldsPerNetwork: null,
  walletResolution: "settled",
  walletScope: null,
};

describe("Earn validator reconciliation", () => {
  it("refreshes EVM validator snapshots by address identity", () => {
    const selected = Schema.decodeUnknownSync(EarnValidator)(
      yieldApiValidatorFixture({
        address: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        name: "Stale validator",
      })
    );
    const current = Schema.decodeUnknownSync(EarnValidator)(
      yieldApiValidatorFixture({
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        name: "Current validator",
      })
    );

    expect(
      resolveValidators({
        complete: true,
        entry,
        network: "ethereum",
        selectedValidators: [selected],
        validatorOptions: [current],
      })
    ).toEqual([current]);
  });

  it("removes a missing validator only after a complete observation", () => {
    const selected = Schema.decodeUnknownSync(EarnValidator)(
      yieldApiValidatorFixture()
    );

    expect(
      resolveValidators({
        complete: false,
        entry,
        network: "ethereum",
        selectedValidators: [selected],
        validatorOptions: [],
      })
    ).toEqual([selected]);
    expect(
      resolveValidators({
        complete: true,
        entry,
        network: "ethereum",
        selectedValidators: [selected],
        validatorOptions: [],
      })
    ).toEqual([]);
  });
});
