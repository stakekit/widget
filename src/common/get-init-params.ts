import { Maybe } from "purify-ts";
import { isSupportedChain } from "../domain/types/chains";

export const getInitParams = () => {
  const url = new URL(window.location.href);

  return {
    network: Maybe.fromNullable(url.searchParams.get("network"))
      .chain((val) =>
        typeof val === "string" && isSupportedChain(val)
          ? Maybe.of(val)
          : Maybe.empty()
      )
      .extractNullable(),
    token: Maybe.fromNullable(url.searchParams.get("token")).extractNullable(),
    yieldId: Maybe.fromNullable(
      url.searchParams.get("yieldId")
    ).extractNullable(),
    validator: Maybe.fromNullable(
      url.searchParams.get("validator")
    ).extractNullable(),
  };
};
