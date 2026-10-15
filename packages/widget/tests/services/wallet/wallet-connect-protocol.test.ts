import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber, Option, Queue, Schema } from "effect";
import {
  sharedSignClients,
  walletConnectSessionHint,
  walletConnectSessionOwners,
} from "../../../src/services/wallet/internal/platform/wallet-connect-protocol";
import { isWalletCancellation } from "../../../src/services/wallet/wallet-cancellation";
import { WalletModal } from "../../../src/services/wallet/wallet-modal";
import {
  makeFakeSignClient,
  makeTestWalletConnect,
  makeWalletConnectTestStore,
  walletConnectSession,
} from "../../utils/wallet-connect";

const solanaChain = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const solanaAccount = `${solanaChain}:wallet-public-key`;
const solanaProposal = {
  namespace: "solana",
  chains: [solanaChain],
  requiredMethods: [],
  optionalMethods: ["solana_signTransaction"],
} as const;
const cosmosAccount = "cosmos:cosmoshub-4:cosmos1abc";
const tronAccount = "tron:0x2b6653dc:TXYZ";
/** Approved for cosmos; the wallet also added a tron namespace. */
const cosmosAndTronSession = {
  topic: "cosmos-topic",
  expiry: 4_102_444_800,
  namespaces: {
    cosmos: { accounts: [cosmosAccount], methods: ["cosmos_signDirect"] },
    tron: { accounts: [tronAccount], methods: ["tron_signTransaction"] },
  },
};

describe("WalletConnect protocol", () => {
  it.live(
    "presents the proposal URI and resolves with only the requested namespace of the approval",
    () =>
      Effect.gen(function* () {
        const { modal, protocol, signClient } = yield* makeTestWalletConnect();
        const connecting = yield* protocol
          .connect(solanaProposal)
          .pipe(Effect.forkScoped);

        expect(yield* Queue.take(modal.opened)).toBe(
          "wc:proposal-1@2?relay-protocol=irn&symKey=00"
        );
        expect(signClient.state.proposals).toEqual([
          {
            optionalNamespaces: {
              solana: {
                chains: [solanaChain],
                methods: ["solana_signTransaction"],
                events: [],
              },
            },
          },
        ]);
        signClient.approve({
          topic: "approved-topic",
          expiry: 4_102_444_800,
          sessionProperties: { tron_method_version: "v1" },
          namespaces: {
            solana: {
              accounts: [solanaAccount],
              methods: ["solana_signTransaction"],
            },
            eip155: {
              accounts: ["eip155:1:0xabc"],
              methods: ["eth_sendTransaction"],
            },
          },
        });

        expect(yield* Fiber.join(connecting)).toEqual({
          topic: "approved-topic",
          namespace: "solana",
          accounts: [solanaAccount],
          methods: ["solana_signTransaction"],
          expiry: 4_102_444_800,
          sessionProperties: { tron_method_version: "v1" },
        });
        expect(modal.state.visible).toBeUndefined();
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("requests required methods in requiredNamespaces", () =>
    Effect.gen(function* () {
      const { modal, protocol, signClient } = yield* makeTestWalletConnect();
      yield* protocol
        .connect({
          namespace: "stellar",
          chains: ["stellar:pubnet"],
          requiredMethods: ["stellar_signXDR"],
          optionalMethods: ["stellar_signMessage"],
        })
        .pipe(Effect.forkScoped);
      yield* Queue.take(modal.opened);

      expect(signClient.state.proposals).toEqual([
        {
          requiredNamespaces: {
            stellar: {
              chains: ["stellar:pubnet"],
              methods: ["stellar_signXDR"],
              events: [],
            },
          },
          optionalNamespaces: {
            stellar: {
              chains: ["stellar:pubnet"],
              methods: ["stellar_signMessage"],
              events: [],
            },
          },
        },
      ]);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("resumes the pending proposal after the QR dialog is dismissed", () =>
    Effect.gen(function* () {
      const { modal, protocol, signClient } = yield* makeTestWalletConnect();
      const first = yield* protocol
        .connect(solanaProposal)
        .pipe(Effect.forkScoped);
      const uri = yield* Queue.take(modal.opened);
      yield* Effect.promise(() => modal.modal.close());
      expect(isWalletCancellation(yield* Effect.flip(Fiber.join(first)))).toBe(
        true
      );

      const retry = yield* protocol
        .connect(solanaProposal)
        .pipe(Effect.forkScoped);
      expect(yield* Queue.take(modal.opened)).toBe(uri);
      signClient.approve(
        walletConnectSession({
          topic: "approved-topic",
          namespace: "solana",
          accounts: [solanaAccount],
        })
      );

      expect((yield* Fiber.join(retry)).topic).toBe("approved-topic");
      expect(signClient.state.proposals).toHaveLength(1);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "adopts a session approved after the QR dialog was dismissed without proposing again",
    () =>
      Effect.gen(function* () {
        const { modal, protocol, signClient } = yield* makeTestWalletConnect();
        const first = yield* protocol
          .connect(solanaProposal)
          .pipe(Effect.forkScoped);
        yield* Queue.take(modal.opened);
        yield* Effect.promise(() => modal.modal.close());
        expect(
          isWalletCancellation(yield* Effect.flip(Fiber.join(first)))
        ).toBe(true);

        signClient.approve(
          walletConnectSession({
            topic: "late-topic",
            namespace: "solana",
            accounts: [solanaAccount],
          })
        );
        // Lets the still-running approval settle with nobody waiting on it.
        yield* Effect.sleep("20 millis");

        expect((yield* protocol.connect(solanaProposal)).topic).toBe(
          "late-topic"
        );
        expect(signClient.state.proposals).toHaveLength(1);
        expect(modal.state.visible).toBeUndefined();
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("reports a rejected proposal as a wallet cancellation", () =>
    Effect.gen(function* () {
      const { modal, protocol, signClient } = yield* makeTestWalletConnect();
      const connecting = yield* protocol
        .connect(solanaProposal)
        .pipe(Effect.forkScoped);
      yield* Queue.take(modal.opened);
      signClient.reject({ code: 5000, message: "User rejected." });

      expect(
        isWalletCancellation(yield* Effect.flip(Fiber.join(connecting)))
      ).toBe(true);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "restores only unexpired sessions with the namespace's accounts and skips invalid entries",
    () =>
      Effect.gen(function* () {
        const valid = walletConnectSession({
          topic: "valid-topic",
          namespace: "solana",
          accounts: [solanaAccount],
          methods: ["solana_signMessage"],
        });
        const { protocol } = yield* makeTestWalletConnect(
          makeFakeSignClient({
            sessions: [
              null,
              { topic: 42 },
              walletConnectSession({
                topic: "expired-topic",
                namespace: "solana",
                accounts: [solanaAccount],
                expiry: 1,
              }),
              walletConnectSession({
                topic: "cosmos-topic",
                namespace: "cosmos",
                accounts: ["cosmos:cosmoshub-4:cosmos1abc"],
              }),
              {
                topic: "chain-keyed-topic",
                expiry: 4_102_444_800,
                sessionProperties: { malformed: 1 },
                namespaces: {
                  [solanaChain]: {
                    accounts: [solanaAccount],
                    methods: ["solana_signTransaction"],
                  },
                  eip155: { accounts: "malformed" },
                },
              },
              valid,
            ],
          })
        );

        expect(yield* protocol.sessions("solana")).toEqual([
          {
            topic: "chain-keyed-topic",
            namespace: "solana",
            accounts: [solanaAccount],
            methods: ["solana_signTransaction"],
            expiry: 4_102_444_800,
            sessionProperties: {},
          },
          {
            topic: "valid-topic",
            namespace: "solana",
            accounts: [solanaAccount],
            methods: ["solana_signMessage"],
            expiry: valid.expiry,
            sessionProperties: {},
          },
        ]);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("routes a remote session end only to that topic's listeners", () =>
    Effect.gen(function* () {
      const { protocol, signClient } = yield* makeTestWalletConnect(
        makeFakeSignClient({
          sessions: [
            walletConnectSession({
              topic: "first-topic",
              namespace: "solana",
              accounts: [solanaAccount],
            }),
          ],
        })
      );
      yield* protocol.sessions("solana");
      const ended: Array<string> = [];
      protocol.subscribeEnded("first-topic", () => ended.push("first"));
      const unsubscribe = protocol.subscribeEnded("second-topic", () =>
        ended.push("second")
      );

      signClient.end("first-topic");
      unsubscribe();
      signClient.end("second-topic");

      expect(ended).toEqual(["first"]);
      expect(yield* protocol.sessions("solana")).toEqual([]);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("disconnects only the requested session", () =>
    Effect.gen(function* () {
      const { protocol, signClient } = yield* makeTestWalletConnect(
        makeFakeSignClient({
          sessions: ["first-topic", "second-topic"].map((topic) =>
            walletConnectSession({
              topic,
              namespace: "solana",
              accounts: [solanaAccount],
            })
          ),
        })
      );

      yield* protocol.disconnect("first-topic");

      expect(signClient.state.disconnects).toEqual(["first-topic"]);
      expect(
        (yield* protocol.sessions("solana")).map(({ topic }) => topic)
      ).toEqual(["second-topic"]);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "decodes request responses and maps wallet rejections to cancellations",
    () =>
      Effect.gen(function* () {
        const { protocol, signClient } = yield* makeTestWalletConnect();
        const request = {
          topic: "session-topic",
          chainId: solanaChain,
          method: "solana_signMessage",
          params: { message: "hello" },
          response: Schema.Struct({ signature: Schema.String }),
        };

        signClient.state.respond = async () => ({ signature: "signed" });
        expect(yield* protocol.request(request)).toEqual({
          signature: "signed",
        });
        expect(signClient.state.requests).toEqual([
          {
            topic: "session-topic",
            chainId: solanaChain,
            request: {
              method: "solana_signMessage",
              params: { message: "hello" },
            },
          },
        ]);

        signClient.state.respond = async () => ({ signature: 42 });
        const malformed = yield* Effect.flip(protocol.request(request));
        expect(malformed._tag).toBe("WalletIntegrationError");
        expect(isWalletCancellation(malformed)).toBe(false);

        for (const code of [4001, 5000]) {
          signClient.state.respond = async () => {
            throw { code, message: "Rejected by wallet" };
          };
          expect(
            isWalletCancellation(yield* Effect.flip(protocol.request(request)))
          ).toBe(true);
        }
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "does not load the WalletConnect client on page load before any session was approved",
    () =>
      Effect.gen(function* () {
        const { protocol, clientLoads } = yield* makeTestWalletConnect();

        expect(yield* protocol.sessions("solana")).toEqual([]);
        expect(clientLoads()).toBe(0);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("restores a session approved during an earlier page load", () =>
    Effect.gen(function* () {
      const store = yield* makeWalletConnectTestStore();
      const firstPage = yield* makeTestWalletConnect(makeFakeSignClient(), {
        store,
      });
      const connecting = yield* firstPage.protocol
        .connect(solanaProposal)
        .pipe(Effect.forkScoped);
      yield* Queue.take(firstPage.modal.opened);
      firstPage.signClient.approve(
        walletConnectSession({
          topic: "approved-topic",
          namespace: "solana",
          accounts: [solanaAccount],
        })
      );
      yield* Fiber.join(connecting);

      const reloaded = yield* makeTestWalletConnect(
        makeFakeSignClient({ sessions: firstPage.signClient.state.sessions }),
        { store }
      );

      expect(
        (yield* reloaded.protocol.sessions("solana")).map(({ topic }) => topic)
      ).toEqual(["approved-topic"]);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("returns a session only for the namespace it was approved for", () =>
    Effect.gen(function* () {
      const store = yield* makeWalletConnectTestStore();
      const firstPage = yield* makeTestWalletConnect(makeFakeSignClient(), {
        store,
      });
      const connecting = yield* firstPage.protocol
        .connect({
          namespace: "cosmos",
          chains: ["cosmos:cosmoshub-4"],
          requiredMethods: [],
          optionalMethods: ["cosmos_signDirect"],
        })
        .pipe(Effect.forkScoped);
      yield* Queue.take(firstPage.modal.opened);
      firstPage.signClient.approve(cosmosAndTronSession);
      expect((yield* Fiber.join(connecting)).accounts).toEqual([cosmosAccount]);
      expect(yield* firstPage.protocol.sessions("tron")).toEqual([]);

      const reloaded = yield* makeTestWalletConnect(
        makeFakeSignClient({ sessions: firstPage.signClient.state.sessions }),
        { store }
      );

      expect(
        (yield* reloaded.protocol.sessions("cosmos")).map(({ topic }) => topic)
      ).toEqual(["cosmos-topic"]);
      expect(yield* reloaded.protocol.sessions("tron")).toEqual([]);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("ignores namespaces the wallet adds to an approved session", () =>
    Effect.gen(function* () {
      const signClient = makeFakeSignClient({
        sessions: [
          walletConnectSession({
            topic: "cosmos-topic",
            namespace: "cosmos",
            accounts: [cosmosAccount],
          }),
        ],
      });
      const { protocol } = yield* makeTestWalletConnect(signClient, {
        store: yield* makeWalletConnectTestStore({ "cosmos-topic": "cosmos" }),
      });
      expect(yield* protocol.sessions("tron")).toEqual([]);

      // session_update
      signClient.state.sessions = [cosmosAndTronSession];

      expect(
        (yield* protocol.sessions("cosmos")).map(({ topic }) => topic)
      ).toEqual(["cosmos-topic"]);
      expect(yield* protocol.sessions("tron")).toEqual([]);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("does not restore a stored session this widget never approved", () =>
    Effect.gen(function* () {
      const store = yield* makeWalletConnectTestStore();
      yield* walletConnectSessionHint(store).set(true);
      const { protocol } = yield* makeTestWalletConnect(
        makeFakeSignClient({
          sessions: [
            walletConnectSession({
              topic: "foreign-topic",
              namespace: "solana",
              accounts: [solanaAccount],
            }),
          ],
        }),
        { store }
      );

      expect(yield* protocol.sessions("solana")).toEqual([]);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "forgets the owner of a session that ended, was disconnected or expired",
    () =>
      Effect.gen(function* () {
        const topics = ["ended", "disconnected", "expired", "live"];
        const store = yield* makeWalletConnectTestStore(
          Object.fromEntries(topics.map((topic) => [topic, "solana"] as const))
        );
        const { protocol, signClient } = yield* makeTestWalletConnect(
          makeFakeSignClient({
            sessions: topics.map((topic) =>
              walletConnectSession({
                topic,
                namespace: "solana",
                accounts: [solanaAccount],
                ...(topic === "expired" && { expiry: 1 }),
              })
            ),
          }),
          { store }
        );

        expect(
          (yield* protocol.sessions("solana")).map(({ topic }) => topic)
        ).toEqual(["ended", "disconnected", "live"]);
        signClient.end("ended");
        yield* protocol.disconnect("disconnected");
        // Lets the remote end's owner removal run.
        yield* Effect.sleep("10 millis");

        const owners = walletConnectSessionOwners(store);
        expect(
          yield* Effect.forEach(topics, (topic) =>
            owners.get(topic).pipe(Effect.map(Option.getOrUndefined))
          )
        ).toEqual([undefined, undefined, undefined, "solana"]);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "keeps every topic owned when two tabs sharing storage approve sessions",
    () =>
      Effect.gen(function* () {
        const store = yield* makeWalletConnectTestStore();
        const firstTab = yield* makeTestWalletConnect(makeFakeSignClient(), {
          store,
        });
        const secondTab = yield* makeTestWalletConnect(makeFakeSignClient(), {
          store,
        });
        const cosmosProposal = {
          namespace: "cosmos",
          chains: ["cosmos:cosmoshub-4"],
          requiredMethods: [],
        } as const;
        const firstConnecting = yield* firstTab.protocol
          .connect(solanaProposal)
          .pipe(Effect.forkScoped);
        const secondConnecting = yield* secondTab.protocol
          .connect(cosmosProposal)
          .pipe(Effect.forkScoped);
        yield* Queue.take(firstTab.modal.opened);
        yield* Queue.take(secondTab.modal.opened);

        secondTab.signClient.approve(
          walletConnectSession({
            topic: "cosmos-topic",
            namespace: "cosmos",
            accounts: [cosmosAccount],
          })
        );
        firstTab.signClient.approve(
          walletConnectSession({
            topic: "solana-topic",
            namespace: "solana",
            accounts: [solanaAccount],
          })
        );
        yield* Fiber.join(firstConnecting);
        yield* Fiber.join(secondConnecting);

        const reloaded = yield* makeTestWalletConnect(
          makeFakeSignClient({
            sessions: [
              ...firstTab.signClient.state.sessions,
              ...secondTab.signClient.state.sessions,
            ],
          }),
          { store }
        );

        expect(
          (yield* reloaded.protocol.sessions("solana")).map(
            ({ topic }) => topic
          )
        ).toEqual(["solana-topic"]);
        expect(
          (yield* reloaded.protocol.sessions("cosmos")).map(
            ({ topic }) => topic
          )
        ).toEqual(["cosmos-topic"]);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "reuses one SignClient across runtimes and ends only the closed runtime's subscriptions",
    () =>
      Effect.gen(function* () {
        const signClient = makeFakeSignClient({
          sessions: [
            walletConnectSession({
              topic: "solana-topic",
              namespace: "solana",
              accounts: [solanaAccount],
            }),
          ],
        });
        const store = yield* makeWalletConnectTestStore({
          "solana-topic": "solana",
        });
        let inits = 0;
        const loadClient = sharedSignClients(async () => {
          inits += 1;
          return signClient.client;
        })("test-prefix");

        yield* Effect.gen(function* () {
          const first = yield* makeTestWalletConnect(signClient, {
            store,
            loadClient,
          });
          yield* first.protocol.sessions("solana");
          expect(signClient.endedSubscribers()).toBe(1);
        }).pipe(Effect.scoped);
        expect(signClient.endedSubscribers()).toBe(0);

        const second = yield* makeTestWalletConnect(signClient, {
          store,
          loadClient,
        });

        expect(
          (yield* second.protocol.sessions("solana")).map(({ topic }) => topic)
        ).toEqual(["solana-topic"]);
        expect(inits).toBe(1);
        expect(signClient.endedSubscribers()).toBe(1);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("retries a failed SignClient init on the next load", () =>
    Effect.gen(function* () {
      const signClient = makeFakeSignClient();
      let inits = 0;
      const loadClient = sharedSignClients(async () => {
        inits += 1;
        if (inits === 1) throw new Error("relay unreachable");
        return signClient.client;
      })("test-prefix");

      expect((yield* Effect.flip(loadClient))._tag).toBe(
        "WalletIntegrationError"
      );
      expect(yield* loadClient).toBe(signClient.client);
      expect(yield* loadClient).toBe(signClient.client);
      expect(inits).toBe(2);
    })
  );

  it.live(
    "stops loading the client on later page loads once its last session ended",
    () =>
      Effect.gen(function* () {
        const store = yield* makeWalletConnectTestStore({
          "only-topic": "solana",
        });
        const firstPage = yield* makeTestWalletConnect(
          makeFakeSignClient({
            sessions: [
              walletConnectSession({
                topic: "only-topic",
                namespace: "solana",
                accounts: [solanaAccount],
              }),
            ],
          }),
          { store }
        );
        yield* firstPage.protocol.disconnect("only-topic");

        const reloaded = yield* makeTestWalletConnect(makeFakeSignClient(), {
          store,
        });

        expect(yield* reloaded.protocol.sessions("solana")).toEqual([]);
        expect(reloaded.clientLoads()).toBe(0);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("drops session accounts that are not CAIP-10 account ids", () =>
    Effect.gen(function* () {
      const { protocol } = yield* makeTestWalletConnect(
        makeFakeSignClient({
          sessions: [
            walletConnectSession({
              topic: "mixed-topic",
              namespace: "solana",
              accounts: [
                `${solanaChain}:`,
                "solana:missing-address",
                solanaAccount,
              ],
            }),
          ],
        })
      );

      expect(
        (yield* protocol.sessions("solana")).map(({ accounts }) => accounts)
      ).toEqual([[solanaAccount]]);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );
});
