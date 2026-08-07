import { WCClient } from "@cosmos-kit/walletconnect";
import { DateTime, Duration } from "effect";

const minimumRestorableExpiry = () =>
  // WalletConnect overrides are synchronous and cannot access Effect Clock.
  // ast-grep-ignore: no-unsafe-date-time
  DateTime.toEpochMillis(DateTime.nowUnsafe()) +
  Duration.toMillis(Duration.seconds(1));

export class WalletConnectClient extends WCClient {
  disconnect() {
    this.signClient?.pairing
      .getAll()
      .forEach((p) =>
        this.signClient?.core.pairing.disconnect({ topic: p.topic })
      );

    return super.disconnect();
  }

  restorePairings() {
    if (typeof this.signClient === "undefined") {
      throw new Error("WalletConnect is not initialized");
    }
    const minimumExpiry = minimumRestorableExpiry();
    this.pairings = this.signClient.pairing
      .getAll({ active: true })
      .filter((p) => p.expiry * 1000 > minimumExpiry);
    this.logger?.debug("RESTORED PAIRINGS: ", this.pairings);
  }

  restoreSessions() {
    if (typeof this.signClient === "undefined") {
      throw new Error("WalletConnect is not initialized");
    }
    const minimumExpiry = minimumRestorableExpiry();
    this.sessions = this.signClient.session
      .getAll()
      .filter((s) => s.expiry * 1000 > minimumExpiry);
    this.logger?.debug("RESTORED SESSIONS: ", this.sessions);
  }
}
