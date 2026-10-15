/**
 * Prunes an OpenAPI document to an operation allowlist before generation.
 *
 * Keeps the allowlisted operations, every component they reference directly or
 * indirectly, and explicitly named extra schemas. Everything else is removed so
 * unused operations and schemas never reach generated source or bundles.
 *
 * openapigen only emits components reachable from an operation, so extra
 * schemas get a synthetic root operation for schema-only generation; the
 * aliases it emits are stripped from the generated source afterwards.
 */

export type OpenApiPruneConfig = {
  /** Spec `operationId`s to keep (after any `prepareSpec` rewriting). */
  readonly operations: ReadonlyArray<string>;
  /** Component schemas to keep even when no kept operation references them. */
  readonly extraSchemas?: ReadonlyArray<string>;
};

type JsonObject = Record<string, unknown>;

const httpMethods: Record<string, true> = {
  delete: true,
  get: true,
  head: true,
  options: true,
  patch: true,
  post: true,
  put: true,
  trace: true,
};

const componentRefPattern = /^#\/components\/([^/]+)\/([^/]+)$/;

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const componentKey = (section: string, name: string) => `${section}/${name}`;

const collectComponentRefs = (value: unknown, refs: Array<string>): void => {
  if (Array.isArray(value)) {
    for (const item of value) collectComponentRefs(item, refs);
    return;
  }
  if (!isJsonObject(value)) return;

  for (const [key, child] of Object.entries(value)) {
    if (key === "$ref" && typeof child === "string") {
      const match = componentRefPattern.exec(child);
      if (match?.[1] && match[2]) {
        const name = match[2].replaceAll("~1", "/").replaceAll("~0", "~");
        refs.push(componentKey(match[1], name));
      }
      continue;
    }
    collectComponentRefs(child, refs);
  }
};

/**
 * Mutates `document` in place. Throws when an allowlisted operation or extra
 * schema does not exist, so a renamed upstream operation fails generation
 * instead of silently disappearing from the client.
 */
export const pruneOpenApiDocument = (
  document: unknown,
  { extraSchemas = [], operations }: OpenApiPruneConfig
): void => {
  if (!isJsonObject(document) || !isJsonObject(document.paths)) {
    throw new Error("OpenAPI document has no paths object");
  }

  const components = isJsonObject(document.components)
    ? document.components
    : {};
  const allowlist = new Set(operations);
  const foundOperations = new Set<string>();
  const pendingRefs: Array<string> = extraSchemas.map((name) =>
    componentKey("schemas", name)
  );

  for (const [pathName, pathItem] of Object.entries(document.paths)) {
    if (!isJsonObject(pathItem)) continue;

    let keptOperations = 0;
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!httpMethods[method]) continue;

      const operationId = isJsonObject(operation)
        ? operation.operationId
        : undefined;
      if (typeof operationId === "string" && allowlist.has(operationId)) {
        foundOperations.add(operationId);
        keptOperations += 1;
      } else {
        delete pathItem[method];
      }
    }

    if (keptOperations === 0) {
      delete document.paths[pathName];
    } else {
      collectComponentRefs(pathItem, pendingRefs);
    }
  }

  const missingOperations = operations.filter(
    (operationId) => !foundOperations.has(operationId)
  );
  if (missingOperations.length > 0) {
    throw new Error(
      `Allowlisted operations not found in spec: ${missingOperations.join(", ")}`
    );
  }

  const keptComponents = new Set<string>();
  for (
    let ref = pendingRefs.pop();
    ref !== undefined;
    ref = pendingRefs.pop()
  ) {
    if (keptComponents.has(ref)) continue;

    const separator = ref.indexOf("/");
    const section = ref.slice(0, separator);
    const name = ref.slice(separator + 1);
    const sectionEntries = components[section];
    const component = isJsonObject(sectionEntries)
      ? sectionEntries[name]
      : undefined;
    if (component === undefined) {
      throw new Error(`Referenced component not found in spec: ${ref}`);
    }

    keptComponents.add(ref);
    collectComponentRefs(component, pendingRefs);
  }

  for (const [section, entries] of Object.entries(components)) {
    // Security schemes are referenced by name from `security`, not by `$ref`.
    if (section === "securitySchemes" || !isJsonObject(entries)) continue;

    for (const name of Object.keys(entries)) {
      if (!keptComponents.has(componentKey(section, name))) {
        delete entries[name];
      }
    }
  }
};

const extraSchemaRootName = (name: string) => `ExtraSchemaRoot${name}`;

/**
 * Returns a copy of `document` with one synthetic `GET` operation per extra
 * schema, so openapigen emits each extra schema as a named export.
 */
export const withExtraSchemaRoots = (
  document: unknown,
  extraSchemas: ReadonlyArray<string>
): unknown => {
  const copy = structuredClone(document);
  if (!isJsonObject(copy) || !isJsonObject(copy.paths)) {
    throw new Error("OpenAPI document has no paths object");
  }

  for (const name of extraSchemas) {
    copy.paths[`/__extra-schema-root/${name}`] = {
      get: {
        operationId: extraSchemaRootName(name),
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: { $ref: `#/components/schemas/${name}` },
              },
            },
            description: "Generator-only root for an extra schema",
          },
        },
      },
    };
  }

  return copy;
};

/**
 * Removes the response aliases that synthetic extra-schema operations add to
 * schema-only output (`export type|const ExtraSchemaRoot<Name>200 = <Name>`).
 */
export const stripExtraSchemaRoots = (
  source: string,
  extraSchemas: ReadonlyArray<string>
): string => {
  let stripped = source;
  for (const name of extraSchemas) {
    const alias = `${extraSchemaRootName(name)}200`;
    stripped = stripped.replace(
      new RegExp(`^export (?:type|const) ${alias} = ${name};?\\r?\\n`, "gm"),
      ""
    );
    if (stripped.includes(extraSchemaRootName(name))) {
      throw new Error(`Unexpected generated output for extra schema ${name}`);
    }
  }
  return stripped;
};
