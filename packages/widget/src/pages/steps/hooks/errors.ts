export class SignError extends Error {
  _tag = "SignError";
  txId: string;
  network: string;
  customMessage: string | null;

  constructor({
    customMessage = null,
    network,
    txId,
  }: {
    customMessage?: string | null;
    txId: string;
    network: string;
  }) {
    super();

    this._tag = "SignError";
    this.txId = txId;
    this.network = network;
    this.customMessage = customMessage;
  }
}
export class GetStakeSessionError extends Error {
  name = "GetStakeSessionError";
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
