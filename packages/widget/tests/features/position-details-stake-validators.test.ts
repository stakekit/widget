import { Effect, Layer, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import * as Reactivity from "effect/reactivity/Reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { EarnBalance, type EarnYield } from "../../src/domain/earn/models";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import { positionDetailsStakeViewAtom } from "../../src/features/position-details/state/dashboard-stake-facade";
import { PositionDetailsStakeEntryKey } from "../../src/features/position-details/state/dashboard-stake-machine";
import { walletScopeAtom } from "../../src/features/wallet/index";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../src/resources/yield-opportunity/provider";
import {
  PositionBalancesKey,
  positionBalancesAtom,
} from "../../src/resources/yield-positions/yield-positions";
import {
  type ValidatorDirectoryRequest,
  YieldResourceSource,
} from "../../src/services/api/resource-sources";
import {
  yieldApiValidatorFixture,
  yieldApiYieldFixture,
  yieldBalanceFixture,
} from "../fixtures";
import { applicationRuntimeInitInitialValue } from "../utils/widget-config";

const baseYield = yieldApiYieldFixture();
const validatorYield: EarnYield = {
  ...baseYield,
  mechanics: { ...baseYield.mechanics, requiresValidatorSelection: true },
};
const walletScope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x1234567890123456789012345678901234567890"
  ),
  network: "ethereum",
});
const catalogFirst = yieldApiValidatorFixture({
  address: "0x1111111111111111111111111111111111111111",
  name: "Catalog first",
});
const positionValidator = yieldApiValidatorFixture({
  address: "0x2222222222222222222222222222222222222222",
  name: "Position validator",
});
const entryKey = new PositionDetailsStakeEntryKey({
  balanceId: "balance-1",
  integrationId: validatorYield.id,
  walletScope,
});

describe("Position details stake validators", () => {
  it("stakes more with the validator that holds the position", async () => {
    const balance = Schema.decodeSync(EarnBalance)(
      yieldBalanceFixture({
        token: validatorYield.token,
        validator: positionValidator,
      })
    );
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        Atom.initialValue(walletScopeAtom, walletScope),
        Atom.initialValue(
          yieldOpportunityAtom.local(
            new YieldOpportunityKey({ yieldId: validatorYield.id })
          ),
          AsyncResult.success(validatorYield)
        ),
        Atom.initialValue(
          positionBalancesAtom(
            new PositionBalancesKey({
              balanceId: entryKey.balanceId,
              scope: walletScope,
              yieldId: validatorYield.id,
            })
          ),
          AsyncResult.success({ balances: [balance], type: "default" } as never)
        ),
        Atom.initialValue(
          appRuntime.layer,
          Layer.mergeAll(
            Reactivity.layer,
            Layer.succeed(
              YieldResourceSource,
              YieldResourceSource.of({
                listValidators: (request: ValidatorDirectoryRequest) =>
                  Effect.succeed({
                    items: request.preferred
                      ? []
                      : [
                          { ...catalogFirst, key: catalogFirst.address },
                          {
                            ...positionValidator,
                            key: positionValidator.address,
                          },
                        ],
                    limit: request.limit,
                    offset: request.offset,
                    total: request.preferred ? 0 : 2,
                  }),
              } as never)
            )
          ) as never
        ),
      ],
    });
    const viewAtom = positionDetailsStakeViewAtom(entryKey);
    const unmount = registry.mount(viewAtom);

    try {
      await vi.waitFor(() =>
        expect(
          [...registry.get(viewAtom).selectedValidators.values()].map(
            (validator) => validator.address
          )
        ).toEqual([positionValidator.address])
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });
});
