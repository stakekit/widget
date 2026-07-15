export const typeSafeObjectFromEntries = <
  const T extends ReadonlyArray<readonly [PropertyKey, unknown]>,
>(
  entries: T
): { [K in T[number] as K[0]]: K[1] } =>
  Object.fromEntries(entries) as { [K in T[number] as K[0]]: K[1] };

export const typeSafeObjectEntries = <T extends Record<PropertyKey, unknown>>(
  value: T
): { [K in keyof T]: [K, T[K]] }[keyof T][] =>
  Object.entries(value) as { [K in keyof T]: [K, T[K]] }[keyof T][];
