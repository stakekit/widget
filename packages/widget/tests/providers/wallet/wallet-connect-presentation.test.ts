import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Fiber, Queue, Scope } from "effect";
import {
  makeWalletConnectPresentation,
  type WalletConnectModal,
} from "../../../src/services/wallet/internal/platform/wallet-connect-presentation";
import { WalletIntegrationError } from "../../../src/services/wallet/wallet-errors";
import { WalletModal } from "../../../src/services/wallet/wallet-modal";

const uri = "wc:proposal@2?relay-protocol=irn&symKey=0123456789abcdef";

describe("WalletConnect presentation", () => {
  it.live(
    "closes an in-flight QR handoff and ignores late URIs after scope disposal",
    () =>
      Effect.gen(function* () {
        const scope = yield* Scope.make();
        const opening = Promise.withResolvers<void>();
        const opened = Promise.withResolvers<void>();
        const listeners = new Set<(state: { open: boolean }) => void>();
        const visible: { uri: string | undefined } = { uri: undefined };
        const callbacks: Array<(uri: string) => void> = [];
        const subscription = { active: false };
        const modal: WalletConnectModal = {
          open: async ({ uri }) => {
            opened.resolve();
            await opening.promise;
            visible.uri = uri;
            listeners.forEach((listener) => listener({ open: true }));
          },
          close: async () => {
            visible.uri = undefined;
            listeners.forEach((listener) => listener({ open: false }));
          },
          resetWcConnection: () => {},
          subscribeState: (listener) => {
            listeners.add(listener);
            return () => {
              listeners.delete(listener);
            };
          },
        };
        const presentation = yield* makeWalletConnectPresentation(
          Effect.succeed(modal),
          () => {}
        ).pipe(
          Effect.provide(WalletModal.layer),
          Effect.provideService(Scope.Scope, scope)
        );
        const subscribeUri = (publish: (uri: string) => void) =>
          Effect.acquireRelease(
            Effect.sync(() => {
              subscription.active = true;
              callbacks.push(publish);
              publish(uri);
            }),
            () =>
              Effect.sync(() => {
                subscription.active = false;
              })
          );
        yield* presentation
          .connect({ connection: Effect.never, subscribeUri })
          .pipe(Effect.forkIn(scope, { startImmediately: true }));
        yield* Effect.promise(() => opened.promise);

        const disposal = yield* Scope.close(scope, Exit.void).pipe(
          Effect.forkChild({ startImmediately: true })
        );
        opening.resolve();
        yield* Fiber.join(disposal);
        callbacks.forEach((emit) => emit("wc:late-proposal@2"));
        yield* Effect.yieldNow;

        expect(visible.uri).toBeUndefined();
        expect(subscription.active).toBe(false);
        expect(listeners.size).toBe(0);
        expect(
          yield* Effect.flip(
            presentation.connect({
              connection: Effect.never,
              subscribeUri: (publish) => Effect.sync(() => publish(uri)),
            })
          )
        ).toMatchObject({
          _tag: "WalletIntegrationError",
          operation: "wallet-connect-disposed",
        });
      })
  );

  it.live(
    "reports closing the QR dialog as user rejection and releases presentation state",
    () =>
      Effect.gen(function* () {
        const opened = Promise.withResolvers<void>();
        const state: {
          visible: boolean;
          listener: ((state: { open: boolean }) => void) | undefined;
        } = { visible: false, listener: undefined };
        const modal: WalletConnectModal = {
          open: async () => {
            state.visible = true;
            state.listener?.({ open: true });
            opened.resolve();
          },
          close: async () => {
            state.visible = false;
            state.listener?.({ open: false });
          },
          resetWcConnection: () => {},
          subscribeState: (listener) => {
            state.listener = listener;
            return () => {
              state.listener = undefined;
            };
          },
        };
        const presentation = yield* makeWalletConnectPresentation(
          Effect.succeed(modal),
          () => {}
        ).pipe(Effect.provide(WalletModal.layer));
        const connection = yield* presentation
          .connect({
            connection: Effect.never,
            subscribeUri: (publish) => Effect.sync(() => publish(uri)),
          })
          .pipe(Effect.forkScoped({ startImmediately: true }));
        yield* Effect.promise(() => opened.promise);

        state.visible = false;
        state.listener?.({ open: false });
        expect(yield* Effect.flip(Fiber.join(connection))).toMatchObject({
          _tag: "WalletIntegrationError",
          operation: "wallet-connect-cancelled",
          cause: { name: "UserRejectedRequestError", code: 4001 },
        });
        expect(state.visible).toBe(false);
        expect(state.listener).toBeUndefined();
      }).pipe(Effect.scoped)
  );

  it.live(
    "resumes a dismissed SDK approval without letting its late completion disconnect the retry",
    () =>
      Effect.gen(function* () {
        const firstApproval = Promise.withResolvers<string>();
        const nextApproval = Promise.withResolvers<string>();
        const opened = yield* Queue.unbounded<string>();
        const listeners = new Set<(state: { open: boolean }) => void>();
        let emitUri: ((value: string) => void) | undefined;
        let sdkStarts = 0;
        let session: string | undefined;
        let disconnects = 0;
        const modal: WalletConnectModal = {
          open: async ({ uri }) => {
            listeners.forEach((listener) => listener({ open: true }));
            Queue.offerUnsafe(opened, uri);
          },
          close: async () => {
            listeners.forEach((listener) => listener({ open: false }));
          },
          resetWcConnection: () => {},
          subscribeState: (listener) => {
            listeners.add(listener);
            return () => {
              listeners.delete(listener);
            };
          },
        };
        const deepLinks: Array<string> = [];
        const presentation = yield* makeWalletConnectPresentation(
          Effect.succeed(modal),
          (url) => {
            deepLinks.push(url);
          }
        ).pipe(Effect.provide(WalletModal.layer));
        const connection = Effect.tryPromise({
          try: async (signal) => {
            sdkStarts++;
            emitUri?.(sdkStarts === 1 ? uri : "wc:next-proposal@2");
            const approved = await (sdkStarts === 1
              ? firstApproval.promise
              : nextApproval.promise);
            session = approved;
            if (signal.aborted) {
              disconnects++;
              session = undefined;
            }
            return approved;
          },
          catch: (cause) =>
            new WalletIntegrationError({
              cause,
              message: "SDK approval failed",
              operation: "test-connect",
            }),
        });
        const subscribeUri = (publish: (uri: string) => void) =>
          Effect.acquireRelease(
            Effect.promise(async () => {
              await Promise.resolve();
              emitUri = publish;
            }),
            () =>
              Effect.sync(() => {
                emitUri = undefined;
              })
          );
        const first = yield* presentation
          .connect({ connection, subscribeUri })
          .pipe(Effect.forkScoped({ startImmediately: true }));
        expect(yield* Queue.take(opened)).toBe(uri);
        listeners.forEach((listener) => listener({ open: false }));
        expect(yield* Effect.flip(Fiber.join(first))).toMatchObject({
          cause: { code: 4001 },
        });

        const retry = yield* presentation
          .connect({
            connection,
            subscribeUri,
            deepLink: (value) => `wallet://wc?uri=${value}`,
          })
          .pipe(Effect.forkScoped({ startImmediately: true }));
        expect(yield* Queue.take(opened)).toBe(uri);
        expect(deepLinks).toEqual([`wallet://wc?uri=${uri}`]);
        expect(sdkStarts).toBe(1);
        firstApproval.resolve("resumed-session");
        expect(yield* Fiber.join(retry)).toBe("resumed-session");
        expect(session).toBe("resumed-session");
        expect(disconnects).toBe(0);
        expect(emitUri).toBeUndefined();

        const next = yield* presentation
          .connect({ connection, subscribeUri })
          .pipe(Effect.forkScoped({ startImmediately: true }));
        expect(yield* Queue.take(opened)).toBe("wc:next-proposal@2");
        nextApproval.resolve("new-session");
        expect(yield* Fiber.join(next)).toBe("new-session");
        expect(session).toBe("new-session");
        expect(disconnects).toBe(0);
      }).pipe(Effect.scoped)
  );

  it.live("retries a transient modal load failure", () =>
    Effect.gen(function* () {
      const approval = Promise.withResolvers<string>();
      let loads = 0;
      const modal: WalletConnectModal = {
        open: async () => {
          approval.resolve("approved");
        },
        close: async () => {},
        resetWcConnection: () => {},
        subscribeState: () => () => {},
      };
      const presentation = yield* makeWalletConnectPresentation(
        Effect.suspend(() => {
          loads++;
          return loads === 1
            ? Effect.fail(
                new WalletIntegrationError({
                  message: "Temporary import failure",
                  operation: "wallet-connect-load",
                })
              )
            : Effect.succeed(modal);
        }),
        () => {}
      ).pipe(Effect.provide(WalletModal.layer));
      const connection = Effect.tryPromise({
        try: () => approval.promise,
        catch: (cause) =>
          new WalletIntegrationError({
            cause,
            message: "Approval failed",
            operation: "test-connect",
          }),
      });
      const input = {
        connection,
        subscribeUri: (publish: (uri: string) => void) =>
          Effect.sync(() => publish(uri)),
      };
      expect(yield* Effect.flip(presentation.connect(input))).toMatchObject({
        operation: "wallet-connect-load",
      });
      expect(yield* presentation.connect(input)).toBe("approved");
      expect(loads).toBe(2);
    }).pipe(Effect.scoped)
  );

  it.live(
    "deep links each distinct pairing URI once and ignores malformed modal state",
    () =>
      Effect.gen(function* () {
        const approval = Promise.withResolvers<string>();
        const opened = yield* Queue.unbounded<string>();
        const deepLinks: Array<string> = [];
        const listeners = new Set<(state: unknown) => void>();
        let publishUri: ((uri: string) => void) | undefined;
        const modal: WalletConnectModal = {
          open: async ({ uri }) => {
            listeners.forEach((listener) => listener({ open: true }));
            Queue.offerUnsafe(opened, uri);
          },
          close: async () => {},
          resetWcConnection: () => {},
          subscribeState: (listener) => {
            listeners.add(listener);
            return () => {
              listeners.delete(listener);
            };
          },
        };
        const presentation = yield* makeWalletConnectPresentation(
          Effect.succeed(modal),
          (url) => {
            deepLinks.push(url);
          }
        ).pipe(Effect.provide(WalletModal.layer));
        const connecting = yield* presentation
          .connect({
            connection: Effect.promise(() => approval.promise),
            subscribeUri: (publish) =>
              Effect.sync(() => {
                publishUri = publish;
                publish(uri);
              }),
            deepLink: (value) => `wallet://wc?uri=${value}`,
          })
          .pipe(Effect.forkScoped({ startImmediately: true }));
        expect(yield* Queue.take(opened)).toBe(uri);
        for (const state of [undefined, null, { open: "false" }, {}]) {
          listeners.forEach((listener) => listener(state));
        }
        publishUri?.(uri);
        publishUri?.("wc:refreshed-proposal@2");
        expect(yield* Queue.take(opened)).toBe("wc:refreshed-proposal@2");
        approval.resolve("approved");

        expect(yield* Fiber.join(connecting)).toBe("approved");
        expect(deepLinks).toEqual([
          `wallet://wc?uri=${uri}`,
          "wallet://wc?uri=wc:refreshed-proposal@2",
        ]);
      }).pipe(Effect.scoped)
  );
});
