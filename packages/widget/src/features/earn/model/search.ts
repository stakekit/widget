export const getSearchTerms = (query: string): readonly string[] =>
  query.toLowerCase().match(/\S+/g) ?? [];

/** Every term must occur in at least one searchable field of the option. */
export const matchesSearchTerms = (
  terms: readonly string[],
  fields: readonly (string | null | undefined)[]
): boolean => {
  const text = fields.join(" ").toLowerCase();
  return terms.every((term) => text.includes(term));
};
