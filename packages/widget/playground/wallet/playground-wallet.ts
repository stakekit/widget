/**
 * Playground host wallet: an `SKBorrowWallet` whose answers QA steers. Every
 * request takes the next queued wallet outcome (or the default one); a
 * backend performs the request only for outcomes that reach the wallet.
 *
 * Imports `src/public-api/types` rather than the package entry: the entry
 * loads the widget, which Node tests of this module cannot run.
 */
import {
  EvmChainIds,
  MiscChainIds,
  type SKBorrowSignatureResult,
  type SKBorrowTx,
  type SKBorrowTxMeta,
  type SKBorrowTxResult,
  type SKBorrowWallet,
  type SKEip712TypedData,
  type SKTx,
  type SKTxMeta,
  type SKZamaPermitMeta,
  SubstrateChainIds,
  type SupportedSKChainIds,
} from "../../src/public-api/types";

export type WalletRequest =
  | {
      readonly method: "sendTransaction";
      readonly tx: SKTx;
      readonly meta: SKTxMeta;
    }
  | {
      readonly method: "sendBorrowTransaction";
      readonly tx: SKBorrowTx;
      readonly meta: SKBorrowTxMeta;
    }
  | { readonly method: "signMessage"; readonly message: string }
  | {
      readonly method: "signTypedData";
      readonly typedData: SKEip712TypedData;
      readonly meta: SKBorrowTxMeta;
    }
  | {
      readonly method: "signZamaPermit";
      readonly typedData: SKEip712TypedData;
      readonly meta: SKZamaPermitMeta;
    }
  | { readonly method: "switchChain"; readonly chainId: number };

/** A wallet's answer: a hash or signature, a decline, or a failure that may still carry a broadcast hash. */
export type WalletReply =
  | { readonly _tag: "Done"; readonly value: string }
  | { readonly _tag: "Cancelled" }
  | {
      readonly _tag: "Failed";
      readonly error: string;
      readonly txHash?: string;
    };

/** Performs requests against a wallet: scripted, or a real one. */
export type WalletBackend = {
  readonly execute: (request: WalletRequest) => Promise<WalletReply>;
};

export type WalletConnection = {
  readonly address: string;
  /** `undefined` while the wallet is on a chain the widget does not support. */
  readonly chainId: SupportedSKChainIds | undefined;
};

/**
 * How the wallet answers a request. `success`, `errorWithHash` and `hold`
 * reach the wallet first; `hold` then keeps the answer until released.
 * `reject` makes the adapter's Promise reject.
 */
export const walletOutcomes = [
  "success",
  "cancelled",
  "error",
  "errorWithHash",
  "reject",
  "hold",
] as const;
type WalletOutcome = (typeof walletOutcomes)[number];
type HeldAnswer = Exclude<WalletOutcome, "hold">;

export type WalletLogEntry =
  | {
      readonly _tag: "Requested";
      readonly request: WalletRequest;
      readonly outcome: WalletOutcome;
    }
  | { readonly _tag: "Held"; readonly request: WalletRequest }
  | {
      readonly _tag: "Answered";
      readonly request: WalletRequest;
      readonly outcome: WalletOutcome;
      readonly reply: WalletReply | "promise rejected";
      readonly durationMs: number;
    };

type PlaygroundWalletState = {
  readonly connection: WalletConnection;
  readonly queue: ReadonlyArray<WalletOutcome>;
  readonly defaultOutcome: WalletOutcome;
  readonly held: ReadonlyArray<WalletRequest["method"]>;
};

const supportedChainIds = new Set<number>([
  ...Object.values(EvmChainIds),
  ...Object.values(MiscChainIds),
  ...Object.values(SubstrateChainIds),
]);

export const isSupportedChainId = (
  chainId: number
): chainId is SupportedSKChainIds => supportedChainIds.has(chainId);

/** Checks console input; reports unknown outcomes. */
const areWalletOutcomes = (
  outcomes: ReadonlyArray<string>,
  allowed: ReadonlyArray<string> = walletOutcomes
) => {
  const unknown = outcomes.filter((outcome) => !allowed.includes(outcome));
  if (unknown.length > 0) {
    console.error(
      `[playground wallet] Unknown outcome ${unknown.join(", ")}; use one of ${allowed.join(", ")}`
    );
  }
  return unknown.length === 0;
};

const scriptedFailure = "Playground: scripted wallet failure";

const toTxResult = (reply: WalletReply): SKBorrowTxResult => {
  switch (reply._tag) {
    case "Done":
      return { type: "success", txHash: reply.value };
    case "Cancelled":
      return { type: "cancelled" };
    case "Failed":
      return reply.txHash === undefined
        ? { type: "error", error: reply.error }
        : { type: "error", error: reply.error, txHash: reply.txHash };
  }
};

const toSignatureResult = (reply: WalletReply): SKBorrowSignatureResult => {
  switch (reply._tag) {
    case "Done":
      return { type: "success", signature: reply.value };
    case "Cancelled":
      return { type: "cancelled" };
    case "Failed":
      return { type: "error", error: reply.error };
  }
};

/** Console and panel controls. Input is checked at runtime: it comes from the console. */
export type WalletControls = {
  /** Queues outcomes for the next wallet requests, in order. */
  readonly next: (...outcomes: ReadonlyArray<WalletOutcome>) => void;
  /** Sets the outcome for requests with nothing queued. */
  readonly setDefault: (outcome: WalletOutcome) => void;
  /** Answers the oldest held request, by default with success. */
  readonly release: (answer?: HeldAnswer) => void;
  /** Clears queued outcomes and restores the success default. */
  readonly reset: () => void;
  readonly setAddress: (address: string) => void;
  readonly disconnect: () => void;
  /** Reports the chain the wallet is on; an unsupported one leaves it unknown. */
  readonly setChain: (chainId: number) => void;
};

export type PlaygroundWallet = {
  /** Host wallet adapter passed to the widget; stable for the page's lifetime. */
  readonly provider: SKBorrowWallet;
  readonly controls: WalletControls;
  readonly getState: () => PlaygroundWalletState;
  readonly subscribe: (listener: () => void) => () => void;
};

export const makePlaygroundWallet = ({
  backend,
  connection,
  log,
}: {
  readonly backend: WalletBackend;
  readonly connection: WalletConnection;
  readonly log: (entry: WalletLogEntry) => void;
}): PlaygroundWallet => {
  const queue: Array<WalletOutcome> = [];
  const held: Array<{
    readonly request: WalletRequest;
    readonly release: (answer: HeldAnswer) => void;
  }> = [];
  const listeners = new Set<() => void>();
  const current: {
    connection: WalletConnection;
    defaultOutcome: WalletOutcome;
    state: PlaygroundWalletState;
  } = {
    connection,
    defaultOutcome: "success",
    state: { connection, queue: [], defaultOutcome: "success", held: [] },
  };

  const publish = () => {
    current.state = {
      connection: current.connection,
      queue: [...queue],
      defaultOutcome: current.defaultOutcome,
      held: held.map(({ request }) => request.method),
    };
    for (const listener of listeners) listener();
  };

  const setConnection = (next: Partial<WalletConnection>) => {
    current.connection = { ...current.connection, ...next };
    publish();
  };

  const holdAnswer = (request: WalletRequest) => {
    const { promise, resolve } = Promise.withResolvers<HeldAnswer>();
    const entry = {
      request,
      release: (answer: HeldAnswer) => {
        held.splice(held.indexOf(entry), 1);
        publish();
        resolve(answer);
      },
    };
    held.push(entry);
    publish();
    log({ _tag: "Held", request });
    return promise;
  };

  const answerWith = (
    request: WalletRequest,
    answer: HeldAnswer,
    value: string
  ): WalletReply => {
    switch (answer) {
      case "success":
        return { _tag: "Done", value };
      case "errorWithHash":
        return { _tag: "Failed", error: scriptedFailure, txHash: value };
      case "cancelled":
        return { _tag: "Cancelled" };
      case "error":
        return { _tag: "Failed", error: scriptedFailure };
      case "reject":
        throw new Error(`Playground: scripted ${request.method} failure`);
    }
  };

  const decide = async (
    request: WalletRequest,
    outcome: WalletOutcome
  ): Promise<WalletReply> => {
    if (
      outcome !== "success" &&
      outcome !== "errorWithHash" &&
      outcome !== "hold"
    ) {
      return answerWith(request, outcome, "");
    }
    const executed = await backend.execute(request);
    if (executed._tag !== "Done") return executed;
    const answer = outcome === "hold" ? await holdAnswer(request) : outcome;
    return answerWith(request, answer, executed.value);
  };

  const run = async (request: WalletRequest): Promise<WalletReply> => {
    const outcome = queue.shift() ?? current.defaultOutcome;
    publish();
    log({ _tag: "Requested", request, outcome });
    const startedAt = performance.now();
    const answered = (reply: WalletReply | "promise rejected") =>
      log({
        _tag: "Answered",
        request,
        outcome,
        reply,
        durationMs: Math.round(performance.now() - startedAt),
      });

    try {
      const reply = await decide(request, outcome);
      answered(reply);
      return reply;
    } catch (error) {
      answered("promise rejected");
      throw error;
    }
  };

  const provider: SKBorrowWallet = {
    sendTransaction: async (tx, meta) =>
      toTxResult(await run({ method: "sendTransaction", tx, meta })),
    sendBorrowTransaction: async (tx, meta) =>
      toTxResult(await run({ method: "sendBorrowTransaction", tx, meta })),
    signMessage: async (message) =>
      toSignatureResult(await run({ method: "signMessage", message })),
    signTypedData: async (typedData, meta) =>
      toSignatureResult(
        await run({ method: "signTypedData", typedData, meta })
      ),
    signZamaPermit: async (typedData, meta) =>
      toSignatureResult(
        await run({ method: "signZamaPermit", typedData, meta })
      ),
    switchChain: async (chainId) => {
      const reply = await run({ method: "switchChain", chainId });
      if (reply._tag !== "Done") {
        throw new Error(
          reply._tag === "Failed" ? reply.error : "Chain switch declined"
        );
      }
      setConnection({
        chainId: isSupportedChainId(chainId) ? chainId : undefined,
      });
    },
  };

  const controls: WalletControls = {
    next: (...outcomes) => {
      if (!areWalletOutcomes(outcomes)) return;
      queue.push(...outcomes);
      publish();
    },
    setDefault: (outcome) => {
      if (!areWalletOutcomes([outcome])) return;
      current.defaultOutcome = outcome;
      publish();
    },
    release: (answer = "success") => {
      const answers = walletOutcomes.filter((outcome) => outcome !== "hold");
      if (!areWalletOutcomes([answer], answers)) return;
      const [oldest] = held;
      if (oldest === undefined) {
        console.warn("[playground wallet] No held request to release");
        return;
      }
      oldest.release(answer);
    },
    reset: () => {
      queue.length = 0;
      current.defaultOutcome = "success";
      publish();
    },
    setAddress: (address) => setConnection({ address }),
    disconnect: () => setConnection({ address: "" }),
    setChain: (chainId) => {
      if (!isSupportedChainId(chainId)) {
        console.warn(
          `[playground wallet] chain ${chainId} is not supported by the widget`
        );
      }
      setConnection({
        chainId: isSupportedChainId(chainId) ? chainId : undefined,
      });
    },
  };

  return {
    provider,
    controls,
    getState: () => current.state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
