import { describe, expect, it } from "vitest";
import {
  pruneOpenApiDocument,
  stripExtraSchemaRoots,
  withExtraSchemaRoots,
} from "../../scripts/generated-api/prune-openapi-document";

const ref = (section: string, name: string) => ({
  $ref: `#/components/${section}/${name}`,
});

const makeDocument = () => ({
  openapi: "3.0.0",
  paths: {
    "/tokens": {
      parameters: [ref("parameters", "Network")],
      get: {
        operationId: "TokenController_getTokens",
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: { items: ref("schemas", "TokenDto"), type: "array" },
              },
            },
          },
        },
      },
      post: {
        operationId: "TokenController_createToken",
        requestBody: ref("requestBodies", "CreateToken"),
      },
    },
    "/admin": {
      get: {
        operationId: "AdminController_list",
        responses: { "200": ref("responses", "AdminList") },
      },
    },
  },
  components: {
    parameters: {
      Network: {
        in: "query",
        name: "network",
        schema: ref("schemas", "Networks"),
      },
      Unused: { in: "query", name: "unused" },
    },
    requestBodies: {
      CreateToken: {
        content: {
          "application/json": { schema: ref("schemas", "CreateTokenDto") },
        },
      },
    },
    responses: {
      AdminList: {
        content: { "application/json": { schema: ref("schemas", "AdminDto") } },
      },
    },
    schemas: {
      AdminDto: {
        properties: { token: ref("schemas", "TokenDto") },
        type: "object",
      },
      CreateTokenDto: { type: "object" },
      FeeDto: { type: "object" },
      MetadataDto: { type: "object" },
      Networks: { enum: ["ethereum"], type: "string" },
      PriceDto: {
        properties: { fee: ref("schemas", "FeeDto") },
        type: "object",
      },
      TokenDto: {
        properties: {
          metadata: { allOf: [ref("schemas", "MetadataDto")] },
          prices: {
            additionalProperties: ref("schemas", "PriceDto"),
            type: "object",
          },
        },
        type: "object",
      },
      UnusedDto: { type: "object" },
      YieldType: { enum: ["staking"], type: "string" },
    },
    securitySchemes: {
      apiKey: { in: "header", name: "X-API-KEY", type: "apiKey" },
    },
  },
});

describe("pruneOpenApiDocument", () => {
  it("keeps allowlisted operations, their transitive components, and extra schemas", () => {
    const document = makeDocument();

    pruneOpenApiDocument(document, {
      extraSchemas: ["YieldType"],
      operations: ["TokenController_getTokens"],
    });

    expect(Object.keys(document.paths)).toEqual(["/tokens"]);
    expect(Object.keys(document.paths["/tokens"])).toEqual([
      "parameters",
      "get",
    ]);
    expect(Object.keys(document.components.schemas).sort()).toEqual([
      "FeeDto",
      "MetadataDto",
      "Networks",
      "PriceDto",
      "TokenDto",
      "YieldType",
    ]);
    expect(Object.keys(document.components.parameters)).toEqual(["Network"]);
    expect(document.components.requestBodies).toEqual({});
    expect(document.components.responses).toEqual({});
    expect(Object.keys(document.components.securitySchemes)).toEqual([
      "apiKey",
    ]);
  });

  it("fails when an allowlisted operation is missing from the spec", () => {
    expect(() =>
      pruneOpenApiDocument(makeDocument(), {
        operations: ["TokenController_getTokens", "TokenController_renamed"],
      })
    ).toThrow(
      "Allowlisted operations not found in spec: TokenController_renamed"
    );
  });

  it("fails when an extra schema is missing from the spec", () => {
    expect(() =>
      pruneOpenApiDocument(makeDocument(), {
        extraSchemas: ["MissingDto"],
        operations: ["TokenController_getTokens"],
      })
    ).toThrow("Referenced component not found in spec: schemas/MissingDto");
  });
});

describe("extra schema roots", () => {
  it("adds one generator-only root per extra schema without mutating the input", () => {
    const document = makeDocument();

    const rooted = withExtraSchemaRoots(document, ["YieldType"]) as {
      readonly paths: Record<string, unknown>;
    };

    expect(document.paths).not.toHaveProperty("/__extra-schema-root/YieldType");
    expect(rooted.paths["/__extra-schema-root/YieldType"]).toEqual({
      get: expect.objectContaining({
        operationId: "ExtraSchemaRootYieldType",
        responses: {
          "200": expect.objectContaining({
            content: {
              "application/json": { schema: ref("schemas", "YieldType") },
            },
          }),
        },
      }),
    });
  });

  it("strips the root aliases from generated schema source", () => {
    const source = [
      "export type YieldType = 'staking';",
      "export type ExtraSchemaRootYieldType200 = YieldType;",
      "export const ExtraSchemaRootYieldType200 = YieldType;",
      "",
    ].join("\n");

    expect(stripExtraSchemaRoots(source, ["YieldType"])).toBe(
      "export type YieldType = 'staking';\n"
    );
  });

  it("fails when a root leaves unexpected generated output behind", () => {
    expect(() =>
      stripExtraSchemaRoots(
        "export type ExtraSchemaRootYieldType200 = { readonly a: string };\n",
        ["YieldType"]
      )
    ).toThrow("Unexpected generated output for extra schema YieldType");
  });
});
