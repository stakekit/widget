import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";

import { earnSelectionValidatorOptionsViewAtom } from "../../../src/features/earn/state/earn-selection";
import { earnValidatorSelectionViewAtom } from "../../../src/features/earn/state/validator-selection";
import type { SKAppProps } from "../../../src/public-api/react-types";
import { yieldApiValidatorFixture, yieldApiYieldFixture } from "../../fixtures";
import { decodeValidator } from "../../utils/validators";
import { applicationRuntimeInitInitialValue } from "../../utils/widget-config";

const selectedYield = yieldApiYieldFixture();
const { network } = selectedYield.token;

const validator = (address: string, rate: number, preferred = false) =>
  decodeValidator(
    yieldApiValidatorFixture({
      address,
      preferred,
      rewardRate: { rateType: "APR", total: rate },
    })
  );
const hostFirst = validator("host-first", 0.03, true);
const hostSecond = validator("host-second", 0.05, true);
const apiPreferred = validator("api-preferred", 0.07, true);
const other = validator("other", 0.06);
// As the Earn Selection lists them, before the picker orders them.
const options = [apiPreferred, hostFirst, hostSecond, other];

const pickerOrder = (
  validatorsConfig: NonNullable<SKAppProps["validatorsConfig"]>
) => {
  const registry = AtomRegistry.make({
    initialValues: [
      applicationRuntimeInitInitialValue({
        apiKey: "test-api-key",
        layout: "dashboard",
        validatorsConfig,
        variant: "default",
      }),
      Atom.initialValue(earnSelectionValidatorOptionsViewAtom, {
        canSelect: true,
        enabled: true,
        isDebouncing: false,
        items: options,
        page: {
          hasMore: false,
          isLoadingFirstPage: false,
          isLoadingMore: false,
        },
        search: "",
        selected: [],
        selectedYield,
      }),
    ],
  });

  try {
    return registry
      .get(earnValidatorSelectionViewAtom)
      .data?.map(({ address }) => address);
  } finally {
    registry.dispose();
  }
};

describe("Earn validator order in the dashboard layout", () => {
  it("orders validators by reward rate without a listed order", () => {
    expect(
      pickerOrder({
        [network]: { preferred: [hostFirst.address, hostSecond.address] },
      })
    ).toEqual(["api-preferred", "other", "host-second", "host-first"]);
  });

  it("keeps the policy's ranked validators first, then orders the rest by reward rate", () => {
    expect(
      pickerOrder({
        [network]: {
          preferred: [hostFirst.address, hostSecond.address],
          preferredOrder: "listed",
        },
      })
    ).toEqual(["host-first", "host-second", "api-preferred", "other"]);
  });
});
