import { describe, expect, it } from "@effect/vitest";
import { Effect, Logger, Schema } from "effect";
import {
  ActionTransactionReceipt,
  YieldAction,
} from "../../src/domain/action/models";
import { EarnPositionsResponse, EarnYield } from "../../src/domain/earn/models";
import {
  RewardRateHistoryResponse,
  TvlHistoryResponse,
} from "../../src/domain/portfolio/models";
import {
  yieldApiActionDtoFixture,
  yieldApiTransactionDtoFixture,
  yieldApiValidatorFixture,
  yieldApiYieldDtoFixture,
} from "../fixtures";

// The API adds enum values independently of the generated client. These
// fixtures carry values no generated literal knows about.
const UNKNOWN = "value-added-after-generation";

const decode = <S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  input: unknown
) =>
  Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.provide(Logger.layer([]))
  );

describe("API responses with values added after client generation", () => {
  it.effect("decodes a yield whose unread metadata has unknown values", () =>
    Effect.gen(function* () {
      const yieldDto = yieldApiYieldDtoFixture();
      const result = yield* decode(EarnYield, {
        ...yieldDto,
        metadata: { ...yieldDto.metadata, supportedStandards: [UNKNOWN] },
        mechanics: {
          ...yieldDto.mechanics,
          extraTransactionFormatsSupported: [UNKNOWN],
          requirements: {
            kycRequired: true,
            kyc: {
              kycMode: UNKNOWN,
              iframeAllowed: false,
              eligibility: { defaultPolicy: UNKNOWN, subjectTypes: [UNKNOWN] },
            },
          },
        },
        investmentSchedule: { subscription: { paths: [{ kind: UNKNOWN }] } },
        state: { allocations: [{ network: UNKNOWN }] },
        risk: { ratings: [{ rating: "A", source: UNKNOWN }] },
      });

      expect(result.id).toBe(yieldDto.id);
      expect(result.mechanics.requirements?.kycRequired).toBe(true);
      expect(result.risk?.ratings[0]?.source).toBe(UNKNOWN);
    })
  );

  it.effect(
    "drops only the reward components and secondary tokens it cannot represent",
    () =>
      Effect.gen(function* () {
        const yieldDto = yieldApiYieldDtoFixture();
        const unknownNetworkToken = { ...yieldDto.token, network: UNKNOWN };
        const component = {
          rate: 0.03,
          rateType: "APY",
          token: yieldDto.token,
          yieldSource: "staking",
          description: "Staking",
        };
        const result = yield* decode(EarnYield, {
          ...yieldDto,
          tokens: [yieldDto.token, unknownNetworkToken],
          inputTokens: [unknownNetworkToken, yieldDto.token],
          rewardRate: {
            ...yieldDto.rewardRate,
            components: [
              component,
              { ...component, yieldSource: UNKNOWN },
              { ...component, token: unknownNetworkToken },
            ],
          },
        });

        expect(result.tokens).toEqual([yieldDto.token]);
        expect(result.inputTokens).toEqual([yieldDto.token]);
        expect(
          result.rewardRate.components.map(({ yieldSource }) => yieldSource)
        ).toEqual(["staking", UNKNOWN]);
      })
  );

  it.effect(
    "ignores unknown optional mechanic arguments but rejects unknown required ones",
    () =>
      Effect.gen(function* () {
        const yieldDto = yieldApiYieldDtoFixture();
        const withEnterFields = (fields: ReadonlyArray<unknown>) => ({
          ...yieldDto,
          mechanics: {
            ...yieldDto.mechanics,
            arguments: { enter: { fields } },
          },
        });
        const amount = { label: "Amount", name: "amount", type: "string" };
        const unknownArgument = { label: "New", name: UNKNOWN, type: UNKNOWN };

        const optional = yield* decode(
          EarnYield,
          withEnterFields([amount, { ...unknownArgument, required: false }])
        );
        const required = yield* Effect.flip(
          decode(
            EarnYield,
            withEnterFields([amount, { ...unknownArgument, required: true }])
          )
        );
        const requiredUnknownType = yield* Effect.flip(
          decode(
            EarnYield,
            withEnterFields([
              amount,
              {
                label: "Duration",
                name: "duration",
                type: UNKNOWN,
                required: true,
              },
            ])
          )
        );

        expect(optional.mechanics.arguments?.enter?.fields.amount).toEqual({
          maximum: null,
          minimum: expect.anything(),
          required: false,
        });
        expect(required.message).toContain(UNKNOWN);
        expect(requiredUnknownType.message).toContain("duration");
      })
  );

  it.effect(
    "keeps a position and drops only its balances, pending actions and validators with unknown values",
    () =>
      Effect.gen(function* () {
        const { token } = yieldApiYieldDtoFixture();
        const pendingAction = {
          intent: "manage",
          type: "CLAIM_REWARDS",
          passthrough: "claim",
        };
        const validator = yieldApiValidatorFixture();
        const balance = {
          address: "wallet-1",
          type: "active",
          amount: "1.5",
          amountRaw: "1500000000000000000",
          pendingActions: [pendingAction, { ...pendingAction, type: UNKNOWN }],
          validators: [validator, { ...yieldApiValidatorFixture(), status: 1 }],
          token,
          isEarning: true,
        };

        const result = yield* decode(EarnPositionsResponse, {
          errors: [],
          items: [
            {
              yieldId: "ethereum-eth-native-staking",
              balances: [balance, { ...balance, type: UNKNOWN }],
              outputTokenBalance: { ...balance, type: UNKNOWN },
            },
          ],
        });

        const [position] = result.items;
        expect(position?.balances).toHaveLength(1);
        expect(
          position?.balances[0]?.pendingActions.map(({ type }) => type)
        ).toEqual(["CLAIM_REWARDS"]);
        expect(
          position?.balances[0]?.validators?.map(({ address }) => address)
        ).toEqual([validator.address]);
        expect(position?.outputTokenBalance).toBeNull();
      })
  );

  it.effect("decodes an action whose unread metadata has unknown values", () =>
    Effect.gen(function* () {
      const actionDto = yieldApiActionDtoFixture();
      const result = yield* decode(YieldAction, {
        ...actionDto,
        executionPattern: UNKNOWN,
        events: [{ type: UNKNOWN }],
      });

      expect(result.id).toBe(actionDto.id);
    })
  );

  it.effect(
    "reads a transaction receipt without validating fields it does not use",
    () =>
      Effect.gen(function* () {
        const transactionDto = yieldApiTransactionDtoFixture();
        const result = yield* decode(ActionTransactionReceipt, {
          ...transactionDto,
          network: UNKNOWN,
          type: UNKNOWN,
          status: "CONFIRMED",
          explorerUrl: "https://explorer.example/tx",
        });
        const unknownStatus = yield* Effect.flip(
          decode(ActionTransactionReceipt, {
            ...transactionDto,
            status: UNKNOWN,
          })
        );

        expect(result).toMatchObject({
          status: "CONFIRMED",
          explorerUrl: "https://explorer.example/tx",
        });
        expect(unknownStatus.message).toContain("status");
      })
  );

  it.effect("decodes chart history whose unread interval is unknown", () =>
    Effect.gen(function* () {
      const history = {
        yieldId: "ethereum-eth-native-staking",
        interval: UNKNOWN,
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-01-02T00:00:00.000Z",
        total: 1,
        offset: 0,
        limit: 100,
      };
      const rewardRates = yield* decode(RewardRateHistoryResponse, {
        ...history,
        items: [
          {
            timestamp: "2026-01-01T00:00:00.000Z",
            rewardRate: "0.05",
          },
        ],
      });
      const tvl = yield* decode(TvlHistoryResponse, {
        ...history,
        items: [
          { timestamp: "2026-01-01T00:00:00.000Z", tvl: "1", tvlRaw: "1" },
        ],
      });

      expect(rewardRates.items).toHaveLength(1);
      expect(tvl.items).toHaveLength(1);
    })
  );
});
