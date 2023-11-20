export class SendTransactionError extends Error {
  name = "SendTransactionError";
}
export class SignError extends Error {
  txId: string;
  network: string;
  name = "SignError";

  constructor({ network, txId }: { txId: string; network: string }) {
    super();
    this.txId = txId;
    this.network = network;
  }
}
export class GetStakeSessionError extends Error {
  name = "GetStakeSessionError";
}
export class TransactionConstructError extends Error {
  name = "TransactionConstructError";
}
export class MissingHashError extends Error {
  name = "MissingHashError";
}
export class TransactionDecodeError extends Error {
  name = "TransactionDecodeError";
}
export class SubmitHashError extends Error {
  name = "SubmitHashError";
}
export class SubmitError extends Error {
  name = "SubmitError";
}
