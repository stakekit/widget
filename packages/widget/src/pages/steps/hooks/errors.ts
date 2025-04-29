export class SignError extends Error {
  _tag = "SignError";
  txId: string;
  network: string;

  constructor({ network, txId }: { txId: string; network: string }) {
    super();

    this._tag = "SignError";
    this.txId = txId;
    this.network = network;
  }
}
export class GetStakeSessionError extends Error {
  name = "GetStakeSessionError";
}
export class TransactionConstructError extends Error {
  _tag = "TransactionConstructError";

  constructor(message?: string) {
    super(message);
    this._tag = "TransactionConstructError";
  }
}
export class TXCheckError extends Error {
  name = "TXCheckError";
}
export class SubmitHashError extends Error {
  name = "SubmitHashError";
}
export class SubmitError extends Error {
  name = "SubmitError";
}
