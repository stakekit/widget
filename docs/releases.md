# Releases

`@stakekit/widget` has two npm release paths:

- Stable releases are produced from `main` through Release Please and use the
  npm `latest` tag.
- Canary releases are manually requested from a selected branch for internal
  StakeKit QA and use the npm `canary` tag.

Canaries are not a public support channel and are never promoted into stable
releases.

## Publishing authority

Repository writers may request and publish a canary workflow run without a
deployment-environment approval. Stable npm publication uses the `production`
GitHub environment, which must require approval from a release maintainer.

Both release paths publish from the existing
`.github/workflows/release.yml` workflow so npm trusted publishing remains
bound to one workflow identity. The npm trusted publisher must not restrict
that workflow identity to a GitHub environment: the stable job supplies the
`production` environment claim, while the canary job intentionally has no
environment.

## Stable releases

A push to `main` runs Release Please. Release Please maintains the release pull
request and creates the package Git tag and GitHub release when that pull
request is merged.

The `production` environment approval gates the stable release job.

The workflow publishes only when all of these conditions hold:

1. A GitHub release exists for `@stakekit/widget@<version>`.
2. That exact package version is not already present on npm.
3. The tagged source builds successfully.

Stable releases publish without an alternate dist-tag and therefore update
`latest`.

## Canary releases

To request a canary:

1. Open **Actions** in GitHub.
2. Select the **Release** workflow.
3. Choose **Run workflow**.
4. Select the branch to test.
5. Start the workflow.

The selected branch must contain the manual release workflow and its
`packages/widget/package.json` version must equal the version currently
published under npm `latest`. Rebase or merge the current stable baseline
before requesting a canary from a stale branch.

For a branch based on `0.0.282`, workflow run `418` publishes:

```text
@stakekit/widget@0.0.283-canary.418
```

The workflow:

1. Checks out the exact selected commit.
2. Reads the current npm `latest` version.
3. Derives `next patch + canary + GITHUB_RUN_NUMBER`.
4. Updates `packages/widget/package.json` only in the runner.
5. Builds the widget and runs its unit and DOM tests.
6. Inspects the package contents.
7. Publishes with the npm `canary` dist-tag.
8. Records the branch, commit, exact version, and install commands in the
   workflow summary.

It does not commit the generated version, create a Git tag, or create a GitHub
release.

## QA usage

Use the moving channel only to obtain the newest published canary:

```sh
pnpm add @stakekit/widget@canary
```

Record and pin the exact version in bug reports, test environments, and QA
sign-off notes:

```sh
pnpm add @stakekit/widget@0.0.283-canary.418
```

Each successful canary publication moves the `canary` dist-tag. The moving tag
is convenient but is not a reproducible test reference.

## Retries and failures

- Rerun the same GitHub workflow run when its commit has not changed. The run
  retains its canary version, and the npm existence check makes a
  post-publication rerun safe.
- Start a new workflow run after changing the branch or selecting a different
  commit. The new run number intentionally creates a new canary version.
- If the branch version is behind npm `latest`, rebase or merge the current
  stable baseline and start a new run.
- If build or tests fail, fix the selected branch and start a new run.

## Stable release after QA

Canary QA sign-off supplies evidence for a later stable release; it does not
promote or retag the canary artifact. Merge the intended changes into `main`
and let Release Please produce and publish the independent stable version.
