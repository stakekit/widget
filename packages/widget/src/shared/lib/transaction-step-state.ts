/**
 * Progress of one transaction through sign, broadcast and status check.
 * Ordered so every later phase compares greater than earlier ones.
 */
export enum TransactionStepState {
  SIGN_IDLE = 0,
  SIGN_ERROR = 1,
  SIGN_LOADING = 2,
  SIGN_SUCCESS = 3,
  BROADCAST_ERROR = 5,
  BROADCAST_LOADING = 6,
  BROADCAST_SUCCESS = 7,
  CHECK_TX_STATUS_ERROR = 9,
  CHECK_TX_STATUS_LOADING = 10,
  CHECK_TX_STATUS_SUCCESS = 11,
}
