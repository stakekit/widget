export class SafeFailedError extends Error {
  _tag = "SafeFailedError";
  type: "NOT_READY" | "FAILED";

  constructor(type: SafeFailedError["type"]) {
    super("Safe tx failed");
    this.type = type;
  }
}
