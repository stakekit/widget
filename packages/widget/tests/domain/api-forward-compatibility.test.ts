import { describe, expect, it } from "@effect/vitest";
import { Effect, Logger, References, Schema } from "effect";
import {
  ActionTransactionReceipt,
  YieldAction,
} from "../../src/domain/action/models";
import {
  EarnPositionsResponse,
  EarnYield,
  EarnYieldPage,
} from "../../src/domain/earn/models";
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
        const requiredSupportedNameUnknownType = yield* Effect.flip(
          decode(
            EarnYield,
            withEnterFields([
              amount,
              {
                label: "Input token",
                name: "inputToken",
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
        expect(required.message).toContain(
          `required enter argument ${UNKNOWN} is not supported`
        );
        expect(requiredSupportedNameUnknownType.message).toContain(
          "inputToken"
        );
      })
  );

  it.effect(
    "drops catalogue yields whose required enter or exit arguments the widget cannot build",
    () =>
      Effect.gen(function* () {
        const issues: Array<unknown> = [];
        const logger = Logger.make<unknown, void>((options) => {
          const annotations = options.fiber.getRef(
            References.CurrentLogAnnotations
          );
          if (annotations.event === "api_decode_rejection") {
            issues.push({
              identifier: annotations.identifier,
              issue: annotations.issue,
            });
          }
        });
        const yieldDto = yieldApiYieldDtoFixture({ prime: false });
        const amount = { label: "Amount", name: "amount", type: "string" };
        const required = (name: string, type = "string") => ({
          label: name,
          name,
          required: true,
          type,
        });
        const withArguments = (id: string, args: Record<string, unknown>) => ({
          ...yieldDto,
          id,
          mechanics: { ...yieldDto.mechanics, arguments: args },
        });

        const page = yield* Schema.decodeEffect(EarnYieldPage)({
          items: [
            yieldDto,
            withArguments("avalanche-avax-liquid-staking", {
              enter: { fields: [amount, required("duration", "number")] },
            }),
            withArguments("ethereum-curve-lp", {
              enter: { fields: [required("amounts")] },
            }),
            withArguments("bsc-pancakeswap-v3-lp", {
              enter: { fields: [amount] },
              exit: {
                fields: [required("tokenId"), required("percentage", "number")],
              },
            }),
            withArguments("ethereum-fee-vault", {
              enter: { fields: [amount, required("feeConfigurationId")] },
            }),
            withArguments("plume-nest-vault", {
              enter: { fields: [amount, required("inputToken")] },
            }),
            withArguments("cosmos-atom-native-staking", {
              enter: {
                fields: [
                  amount,
                  required("validatorAddress"),
                  required("cosmosPubKey"),
                ],
              },
              exit: { fields: [amount, required("cosmosPubKey")] },
            }),
            withArguments("ethereum-kelp-rseth-staking", {
              exit: {
                fields: [
                  amount,
                  {
                    ...required("outputToken"),
                    options: ["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"],
                  },
                ],
              },
            }),
            withArguments("ethereum-manage-duration", {
              manage: {
                CLAIM_REWARDS: { fields: [required("duration", "number")] },
              },
            }),
          ],
          limit: 100,
          offset: 0,
          total: 9,
        }).pipe(Effect.provide(Logger.layer([logger])));

        expect(page.items?.map(({ id }) => id)).toEqual([
          yieldDto.id,
          "plume-nest-vault",
          "cosmos-atom-native-staking",
          "ethereum-kelp-rseth-staking",
          "ethereum-manage-duration",
        ]);
        expect(issues).toEqual([
          {
            identifier: "avalanche-avax-liquid-staking",
            issue: expect.stringContaining(
              "required enter argument duration is not supported"
            ),
          },
          {
            identifier: "ethereum-curve-lp",
            issue: expect.stringContaining(
              "required enter argument amounts is not supported"
            ),
          },
          {
            identifier: "bsc-pancakeswap-v3-lp",
            issue: expect.stringContaining(
              "required exit argument tokenId is not supported"
            ),
          },
          {
            identifier: "ethereum-fee-vault",
            issue: expect.stringContaining(
              "required enter argument feeConfigurationId is not supported"
            ),
          },
        ]);
      })
  );

  it.effect(
    "rejects a required exit argument that only the enter builder supplies",
    () =>
      Effect.gen(function* () {
        const yieldDto = yieldApiYieldDtoFixture();
        const failure = yield* Effect.flip(
          decode(EarnYield, {
            ...yieldDto,
            mechanics: {
              ...yieldDto.mechanics,
              arguments: {
                exit: {
                  fields: [
                    {
                      label: "Input token",
                      name: "inputToken",
                      required: true,
                      type: "string",
                    },
                  ],
                },
              },
            },
          })
        );

        expect(failure.message).toContain(
          "required exit argument inputToken is not supported"
        );
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
