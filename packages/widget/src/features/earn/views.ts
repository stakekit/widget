// Presentational yield/staking views this feature publishes for reuse by
// other features. Everything here is typed on yield, validator, or KYC domain
// models, or carries Earn copy; generic UI kit components live in
// `shared/ui/components`. Kept separate from `composition.ts` so consumers do not pull
// the Earn page graph.
export { EarnDetailsHeader } from "./ui/dashboard/earn-details/components/earn-details-header";
