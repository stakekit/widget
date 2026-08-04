import { describe, expect, it } from "vitest";
import {
  findUnsafeGeneratedSchemaUnions,
  normalizeGeneratedTypeOnlySource,
  normalizeOpenApiUnionObjects,
} from "./generated-schema-safety";

describe("generated schema safety", () => {
  it("opens unbounded object members in OpenAPI unions", () => {
    const document = {
      components: {
        schemas: {
          exactEmptyObject: {
            additionalProperties: false,
            type: "object",
          },
          standaloneObject: { type: "object" },
          payload: {
            oneOf: [{ type: "string" }, { type: "object" }],
          },
          nullableMetadata: {
            anyOf: [{ properties: {}, type: "object" }, { type: "null" }],
          },
        },
      },
    };

    expect(normalizeOpenApiUnionObjects(document)).toBe(2);
    expect(document.components.schemas.payload.oneOf[1]).toEqual({
      additionalProperties: true,
      type: "object",
    });
    expect(document.components.schemas.nullableMetadata.anyOf[0]).toEqual({
      additionalProperties: true,
      properties: {},
      type: "object",
    });
    expect(document.components.schemas.exactEmptyObject).toEqual({
      additionalProperties: false,
      type: "object",
    });
    expect(document.components.schemas.standaloneObject).toEqual({
      type: "object",
    });
  });

  it("reports empty objects that make generated unions ambiguous", () => {
    const source = `
      const payload = Schema.Union(
        [
          Schema.String.annotate({ description: "serialized" }),
          Schema.Struct({}).annotate({ description: "object" })
        ],
        { mode: "oneOf" }
      )
    `;

    expect(findUnsafeGeneratedSchemaUnions(source)).toEqual([
      expect.objectContaining({ line: 5 }),
    ]);
  });

  it("allows records and nullable exact empty objects", () => {
    const source = `
      const payload = Schema.Union([
        Schema.String,
        Schema.Record(Schema.String, Schema.Unknown)
      ])
      const emptyResult = Schema.Union([Schema.Struct({}), Schema.Null])
    `;

    expect(findUnsafeGeneratedSchemaUnions(source)).toEqual([]);
  });

  it("keeps type-only clients independent from runtime Schema imports", () => {
    expect(
      normalizeGeneratedTypeOnlySource(
        "type Payload = { readonly [x: string]: Schema.Json };"
      )
    ).toBe("type Payload = { readonly [x: string]: unknown };");
  });
});
