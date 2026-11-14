import { Cell, loadMessageRelaxed } from "@ton/core";
import { Result } from "effect";

type TonInternalTransfer = {
  readonly address: string;
  readonly amount: string;
  readonly payload: string;
};

/** Reads a base64 message cell as the internal transfer it carries. */
export const decodeInternalTransfer = (
  message: string
): Result.Result<TonInternalTransfer, string> =>
  Result.try({
    try: () => loadMessageRelaxed(Cell.fromBase64(message).beginParse()),
    catch: String,
  }).pipe(
    Result.flatMap(({ body, info }) =>
      info.type === "internal"
        ? Result.succeed({
            address: info.dest.toString(),
            amount: info.value.coins.toString(),
            payload: body.toBoc().toString("base64"),
          })
        : Result.fail("Unsupported TON message: expected an internal message")
    )
  );

/** The hex hash of a base64 bag of cells, e.g. a signed external message. */
export const cellHash = (boc: string): Result.Result<string, string> =>
  Result.try({
    try: () => Cell.fromBase64(boc).hash().toString("hex"),
    catch: String,
  });
