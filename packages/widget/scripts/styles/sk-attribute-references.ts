/**
 * Reads the `data-sk-*` attributes text refers to, by name or in a selector,
 * against `skAttributes`. Shared by `design-system/known-sk-attribute` and
 * the stylesheet checks, so a misspelled attribute or value, which matches
 * nothing and fails silently, is reported wherever it is written. Tooling,
 * so it reads the Design System's list directly rather than through a
 * Design System interface.
 */
import { type SkAttribute, skAttributes } from "../../src/ui/sk-attributes.ts";

type SkAttributeReference = Readonly<{
  /** The reference as written, such as `data-sk-split` or `data-sk-split="x"`. */
  text: string;
  name: string;
  value: string | undefined;
}>;

// A whole name, then an optional `="value"`, `='value'` or bare `=value`
// under any attribute operator. `data-sk-*` in prose names the family, not
// an attribute; a `*` before `=` is the substring operator.
const reference =
  /data-sk-(?![\w-]*\*(?!=))[\w-]*(?:\s*[~|^$*]?=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'\]]+)))?/gu;

const isSkAttribute = (name: string): name is SkAttribute =>
  Object.hasOwn(skAttributes, name);

/** Every `data-sk-*` reference in `text`. */
export const skAttributeReferences = (
  text: string
): ReadonlyArray<SkAttributeReference> =>
  [...text.matchAll(reference)].map((match) => ({
    text: match[0],
    name: match[0].split(/[~|^$*]?=/u)[0]?.trim() ?? match[0],
    value: match[1] ?? match[2] ?? match[3],
  }));

/**
 * Whether `skAttributes` lists the reference's attribute and value. An
 * attribute without values is present or absent, so it takes only `""`.
 */
export const isKnownSkAttributeReference = ({
  name,
  value,
}: Pick<SkAttributeReference, "name" | "value">): boolean => {
  if (!isSkAttribute(name)) return false;
  const values: ReadonlyArray<string> = skAttributes[name].values;
  return (
    value === undefined ||
    (values.length === 0 ? value === "" : values.includes(value))
  );
};

/** The marker of the element carrying the reference's attribute, if any. */
export const skAttributeMarker = ({
  name,
}: Pick<SkAttributeReference, "name">): string | undefined => {
  if (!isSkAttribute(name)) return undefined;
  const attribute: Readonly<{
    values: ReadonlyArray<string>;
    marker?: string;
  }> = skAttributes[name];
  return attribute.marker;
};

/** The references in `text` that `skAttributes` does not list. */
export const unknownSkAttributeReferences = (
  text: string
): ReadonlyArray<string> =>
  skAttributeReferences(text)
    .filter((found) => !isKnownSkAttributeReference(found))
    .map((found) => found.text);
