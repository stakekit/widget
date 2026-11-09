/**
 * Lists every member of a public literal union, so the decoder of a host
 * input stops compiling when the union gains or loses a member.
 */
export const exhaustiveLiterals =
  <All extends number | string>() =>
  <const Values extends ReadonlyArray<All>>(
    values: Exclude<All, Values[number]> extends never ? Values : never
  ) =>
    values;
