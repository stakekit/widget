export type Override<T1, T2> = Omit<T1, keyof T2> & T2;

export type KebabToCamelCase<S extends string> =
  S extends `${infer P1}-${infer P2}${infer P3}`
    ? `${P1}${Capitalize<KebabToCamelCase<`${P2}${P3}`>>}`
    : S;
