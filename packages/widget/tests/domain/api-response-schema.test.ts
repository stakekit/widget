import { describe, expect, it } from "@effect/vitest";
import BigNumber from "bignumber.js";
import { Effect, Logger, References, Schema, SchemaGetter } from "effect";
import {
  TolerantTopLevelArray,
  TolerantTopLevelRecord,
} from "../../src/domain/decoding/response-schema";
import { ExactDecimal } from "../../src/domain/finance/scalars";

const ItemId = Schema.String.pipe(Schema.brand("ResponseSchemaTestItemId"));
const Item = Schema.Struct({
  id: ItemId,
  amount: ExactDecimal,
  nested: Schema.Struct({ enabled: Schema.Boolean }),
});

const ItemIdentifier = Schema.Struct({ id: Schema.String }).pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((value) => value.id),
    encode: SchemaGetter.forbidden(() => "Identifier schema is decode-only"),
  })
);

const Items = TolerantTopLevelArray(Item, {
  operation: "test-items",
  identifier: ItemIdentifier,
});

const Envelope = Schema.Struct({
  items: Items,
  total: Schema.Number,
  offset: Schema.Number,
});

const validItem = (id: string, amount = "1.25") => ({
  id,
  amount,
  nested: { enabled: true },
});

const captureDiagnostics = <A, E>(effect: Effect.Effect<A, E>) => {
  const annotations: Array<Record<string, unknown>> = [];
  const logger = Logger.make<unknown, void>((options) => {
    annotations.push({
      ...options.fiber.getRef(References.CurrentLogAnnotations),
    });
  });

  return {
    annotations,
    result: effect.pipe(Effect.provide(Logger.layer([logger]))),
  };
};

describe("API response schemas", () => {
  it.effect("strictly decodes a valid single domain model", () =>
    Effect.gen(function* () {
      const result = yield* Schema.decodeUnknownEffect(Item)(
        validItem("item-1")
      );

      expect(result.id).toBe("item-1");
      expect(BigNumber.isBigNumber(result.amount)).toBe(true);
      expect(result.amount.toFixed()).toBe("1.25");
    })
  );

  it.effect("rejects a malformed single domain model", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(
        Schema.decodeUnknownEffect(Item)({
          ...validItem("item-1"),
          nested: { enabled: "yes" },
        })
      );

      expect(() => {
        throw failure;
      }).toThrow(/Expected boolean/);
    })
  );

  it.effect("rejects a malformed response envelope", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(
        Schema.decodeUnknownEffect(Envelope)({
          items: [validItem("item-1")],
          total: "1",
          offset: 0,
        })
      );

      expect(() => {
        throw failure;
      }).toThrow(/Expected number/);
    })
  );

  it.effect(
    "keeps valid items in source order and rejects complete invalid parents",
    () =>
      Effect.gen(function* () {
        const decoded = captureDiagnostics(
          Schema.decodeUnknownEffect(Envelope)({
            items: [
              validItem("item-1"),
              {
                ...validItem("item-nested-invalid"),
                nested: { enabled: "yes" },
              },
              validItem("item-2", "9007199254740993.000000000000000001"),
              validItem("item-amount-invalid", "NaN"),
            ],
            total: 4,
            offset: 20,
          })
        );

        const result = yield* decoded.result;

        expect(result.items.map((item) => item.id)).toEqual([
          "item-1",
          "item-2",
        ]);
        expect(result.items[1]?.amount.toFixed()).toBe(
          "9007199254740993.000000000000000001"
        );
        expect(result.total).toBe(4);
        expect(result.offset).toBe(20);
        expect(decoded.annotations).toEqual([
          expect.objectContaining({
            event: "api_decode_rejection",
            operation: "test-items",
            location: "1",
            identifier: "item-nested-invalid",
          }),
          expect.objectContaining({
            event: "api_decode_rejection",
            operation: "test-items",
            location: "3",
            identifier: "item-amount-invalid",
          }),
        ]);
        expect(JSON.stringify(decoded.annotations)).not.toContain(
          'nested":{"enabled":"yes"}'
        );
      })
  );

  it.effect(
    "returns an empty collection when every top-level item is rejected",
    () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknownEffect(Items)([
          validItem("item-1", "NaN"),
          { id: "item-2", amount: "2", nested: { enabled: "yes" } },
        ]);

        expect(result).toEqual([]);
      })
  );

  it.effect("omits an entire key-value entry when its key or value fails", () =>
    Effect.gen(function* () {
      const RecordKey = Schema.String.check(Schema.isPattern(/^item-/)).pipe(
        Schema.brand("ResponseSchemaTestRecordKey")
      );
      const RecordResponse = TolerantTopLevelRecord(RecordKey, Item, {
        operation: "test-record",
        identifier: ItemIdentifier,
      });
      const decoded = captureDiagnostics(
        Schema.decodeUnknownEffect(RecordResponse)({
          "item-a": validItem("item-a"),
          invalid: validItem("item-invalid-key"),
          "item-b": validItem("item-b", "NaN"),
        })
      );

      const result = yield* decoded.result;

      expect(Object.keys(result)).toEqual(["item-a"]);
      expect(Object.values(result)[0]?.id).toBe("item-a");
      expect(decoded.annotations).toEqual([
        expect.objectContaining({
          location: "invalid",
          identifier: "item-invalid-key",
          issue: expect.stringContaining("key:"),
        }),
        expect.objectContaining({
          location: "item-b",
          identifier: "item-b",
          issue: expect.stringContaining("value:"),
        }),
      ]);
    })
  );
});
