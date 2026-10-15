import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { EarnValidator } from "../../../src/domain/earn/models";
import { resolveValidators } from "../../../src/features/earn/state/earn-selection/model/validators";
import { yieldApiValidatorFixture } from "../../fixtures";

const noRequest = { requestedMatch: null, requestedValidator: null };

describe("Earn validator reconciliation", () => {
  it("refreshes EVM validator snapshots by address identity", () => {
    const selected = Schema.decodeSync(EarnValidator)(
      yieldApiValidatorFixture({
        address: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        name: "Stale validator",
      })
    );
    const current = Schema.decodeSync(EarnValidator)(
      yieldApiValidatorFixture({
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        name: "Current validator",
      })
    );

    expect(
      resolveValidators({
        complete: true,
        ...noRequest,
        selectedValidators: [selected],
        validatorOptions: [current],
      })
    ).toEqual([current]);
  });

  it("removes a missing validator only after a complete observation", () => {
    const selected = Schema.decodeSync(EarnValidator)(
      yieldApiValidatorFixture()
    );

    expect(
      resolveValidators({
        complete: false,
        ...noRequest,
        selectedValidators: [selected],
        validatorOptions: [],
      })
    ).toEqual([selected]);
    expect(
      resolveValidators({
        complete: true,
        ...noRequest,
        selectedValidators: [selected],
        validatorOptions: [],
      })
    ).toEqual([]);
  });
});
