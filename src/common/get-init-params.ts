import { Maybe } from "purify-ts";
import { isSupportedChain } from "../domain/types/chains";
import { MaybeWindow } from "../utils/maybe-window";
import { typeSafeObjectFromEntries } from "../utils";

export const getInitParams = () =>
  MaybeWindow.map((w) => new URL(w.location.href))
    .map(
      (url) =>
        [
          ["network", url.searchParams.get("network")],
          ["token", url.searchParams.get("token")],
          ["yieldId", url.searchParams.get("yieldId")],
          ["validator", url.searchParams.get("validator")],
        ] as const
    )
    .map((val) =>
      typeSafeObjectFromEntries(
        val.map(([k, v]) => [
          k,
          k === "network"
            ? Maybe.fromNullable(v)
                .chain((val) =>
                  val && isSupportedChain(val) ? Maybe.of(val) : Maybe.empty()
                )
                .extractNullable()
            : v ?? null,
        ])
      )
    )
    .orDefault({
      network: null,
      token: null,
      yieldId: null,
      validator: null,
    });
