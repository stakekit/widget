export class SafeFailedError extends Error {
  _tag = "SafeFailedError";
  type: "NOT_READY" | "FAILED";

  constructor(type: SafeFailedError["type"]) {
    super("Safe tx failed");
    this.type = type;
  }
}

export class SendTransactionError extends Error {
  _tag = "SendTransactionError";

  constructor(message?: string) {
    super(message);

    this._tag = "SendTransactionError";
  }
}
export class TransactionDecodeError extends Error {
  _tag = "TransactionDecodeError";

  constructor(message?: string) {
    super(message);

    this._tag = "TransactionDecodeError";
  }
}

new SendTransactionError();
