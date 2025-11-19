import { faker } from "@faker-js/faker";
import type { ActionDto, TransactionDto, YieldDto } from "@stakekit/api-hooks";
import {
  getActionControllerEnterResponseMock,
  getActionControllerPendingResponseMock,
  getTransactionControllerConstructResponseMock,
  getYieldV2ControllerGetYieldByIdResponseMock,
} from "@stakekit/api-hooks/msw";
import { Just } from "purify-ts";

const apyFaker = () => faker.number.float({ min: 0, max: 0.05 });

export const yieldFixture = (overrides?: Partial<YieldDto>) =>
  Just(getYieldV2ControllerGetYieldByIdResponseMock())
    .map(
      (val) =>
        ({
          ...getYieldV2ControllerGetYieldByIdResponseMock(),
          rewardRate: apyFaker(),
          rewardType: "apy",
          apy: apyFaker(),
          args: {
            enter: {
              args: {
                nfts: undefined,
                providerId: { required: false, options: [] },
              },
            },
          },
          feeConfigurations: [],
          status: { enter: true, exit: true },
          validators: val.validators.map((v) => ({ ...v, apr: apyFaker() })),
          ...overrides,
        }) satisfies YieldDto
    )
    .unsafeCoerce();

export const enterResponseFixture = (overrides?: Partial<ActionDto>) => ({
  ...getActionControllerEnterResponseMock(),
  ...overrides,
});

export const transactionConstructFixture = (
  overrides?: Partial<TransactionDto>
) => ({
  ...getTransactionControllerConstructResponseMock(),
  ...overrides,
});

export const pendingActionFixture = (overrides?: Partial<ActionDto>) => ({
  ...getActionControllerPendingResponseMock(),
  ...overrides,
});
