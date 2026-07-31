import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { runLogout } from "../../src/features/wallet/state/workflows";
import { WalletConnectionError } from "../../src/services/wallet/domain/errors";

describe("logout workflow", () => {
  it("disconnects before clearing databases", async () => {
    const events: string[] = [];

    await Effect.runPromise(
      runLogout({
        clearDatabases: async () => {
          events.push("clear-databases");
        },
        disconnect: Effect.sync(() => {
          events.push("disconnect");
          return { connectorId: "test" };
        }),
      })
    );

    expect(events).toEqual(["disconnect", "clear-databases"]);
  });

  it("does not clear storage and fails when disconnect fails", async () => {
    const clearDatabases = vi.fn(async () => undefined);

    await expect(
      Effect.runPromise(
        runLogout({
          clearDatabases,
          disconnect: Effect.fail(
            new WalletConnectionError({
              cause: new Error("rejected"),
              operation: "disconnect",
            })
          ),
        })
      )
    ).rejects.toMatchObject({ _tag: "WalletConnectionError" });

    expect(clearDatabases).not.toHaveBeenCalled();
  });
});
