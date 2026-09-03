# Releases

`@stakekit/widget` publishes to npm from `main` through Release Please. Those
releases use the npm `latest` tag.

## Publishing authority

Stable npm publication uses the `production` GitHub environment, which must
require approval from a release maintainer.

Trusted publishing is bound to `.github/workflows/release.yml`.

## Stable releases

A push to `main` runs Release Please. Release Please maintains the release pull
request and creates the package Git tag and GitHub release when that pull
request is merged.

The `production` environment approval gates the release job.

The workflow publishes only when all of these conditions hold:

1. A GitHub release exists for `@stakekit/widget@<version>`.
2. That exact package version is not already present on npm.
3. The tagged source builds successfully.

Stable releases publish without an alternate dist-tag and therefore update
`latest`.
