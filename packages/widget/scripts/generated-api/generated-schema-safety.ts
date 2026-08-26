/**
 * OpenAPI and generated-source checks shared by `gen:api` and the schema
 * safety script.
 */
import ts from "typescript";

type JsonObject = Record<string, unknown>;

type GeneratedSchemaIssue = {
  readonly column: number;
  readonly line: number;
  readonly message: string;
};

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isUnboundedObjectSchema = (value: unknown): value is JsonObject => {
  if (!isJsonObject(value) || value.type !== "object") return false;
  if (value.additionalProperties !== undefined) return false;

  return (
    value.properties === undefined ||
    (isJsonObject(value.properties) &&
      Object.keys(value.properties).length === 0)
  );
};

/**
 * OpenAPI objects allow additional properties unless explicitly disabled.
 * openapigen closes object schemas when the keyword is omitted, which turns
 * arbitrary object members in unions into `Schema.Struct({})`.
 */
export const normalizeOpenApiUnionObjects = (document: unknown): number => {
  let normalizedCount = 0;

  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!isJsonObject(value)) return;

    for (const unionKeyword of ["oneOf", "anyOf"] as const) {
      const members = value[unionKeyword];
      if (!Array.isArray(members)) continue;

      for (const member of members) {
        if (!isUnboundedObjectSchema(member)) continue;
        member.additionalProperties = true;
        normalizedCount += 1;
      }
    }

    for (const child of Object.values(value)) visit(child);
  };

  visit(document);
  return normalizedCount;
};

export const normalizeGeneratedTypeOnlySource = (sourceText: string): string =>
  sourceText.replaceAll("Schema.Json", "unknown");

const schemaMemberName = (expression: ts.Expression): string | undefined => {
  let current = expression;

  while (
    ts.isCallExpression(current) &&
    ts.isPropertyAccessExpression(current.expression) &&
    (current.expression.name.text === "annotate" ||
      current.expression.name.text === "pipe")
  ) {
    current = current.expression.expression;
  }

  if (
    ts.isPropertyAccessExpression(current) &&
    current.expression.getText() === "Schema"
  ) {
    return current.name.text;
  }

  if (
    ts.isCallExpression(current) &&
    ts.isPropertyAccessExpression(current.expression) &&
    current.expression.expression.getText() === "Schema"
  ) {
    return current.expression.name.text;
  }
};

const unwrapSchemaMember = (expression: ts.Expression): ts.Expression => {
  let current = expression;

  while (
    ts.isCallExpression(current) &&
    ts.isPropertyAccessExpression(current.expression) &&
    (current.expression.name.text === "annotate" ||
      current.expression.name.text === "pipe")
  ) {
    current = current.expression.expression;
  }

  return current;
};

const isEmptyStruct = (expression: ts.Expression): boolean => {
  const current = unwrapSchemaMember(expression);
  if (!ts.isCallExpression(current)) return false;
  if (!ts.isPropertyAccessExpression(current.expression)) return false;
  if (current.expression.expression.getText() !== "Schema") return false;
  if (current.expression.name.text !== "Struct") return false;

  const fields = current.arguments[0];
  return (
    fields !== undefined &&
    ts.isObjectLiteralExpression(fields) &&
    fields.properties.length === 0
  );
};

const isOneOfOptions = (expression: ts.Expression | undefined): boolean => {
  if (!expression || !ts.isObjectLiteralExpression(expression)) return false;

  return expression.properties.some(
    (property) =>
      ts.isPropertyAssignment(property) &&
      property.name.getText() === "mode" &&
      ts.isStringLiteral(property.initializer) &&
      property.initializer.text === "oneOf"
  );
};

const overlappingPrimitiveMembers = new Set([
  "BigInt",
  "Boolean",
  "Literal",
  "Literals",
  "Number",
  "String",
]);

export const findUnsafeGeneratedSchemaUnions = (
  sourceText: string,
  fileName = "generated-schema.ts"
): ReadonlyArray<GeneratedSchemaIssue> => {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const issues: GeneratedSchemaIssue[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText() === "Schema" &&
      node.expression.name.text === "Union"
    ) {
      const membersArgument = node.arguments[0];
      if (membersArgument && ts.isArrayLiteralExpression(membersArgument)) {
        const members = [...membersArgument.elements];
        const emptyStruct = members.find(
          (member): member is ts.Expression =>
            ts.isExpression(member) && isEmptyStruct(member)
        );
        const hasOverlappingPrimitive = members.some(
          (member) =>
            ts.isExpression(member) &&
            overlappingPrimitiveMembers.has(schemaMemberName(member) ?? "")
        );

        if (
          emptyStruct &&
          (hasOverlappingPrimitive || isOneOfOptions(node.arguments[1]))
        ) {
          const position = sourceFile.getLineAndCharacterOfPosition(
            emptyStruct.getStart(sourceFile)
          );
          issues.push({
            column: position.character + 1,
            line: position.line + 1,
            message:
              "Unsafe empty object member in Schema.Union; generate Schema.Record(Schema.String, Schema.Unknown) for an arbitrary object",
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return issues;
};
