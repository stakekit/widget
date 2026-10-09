#!/bin/sh
# Installs the pinned mise release, puts mise and its shims on PATH, and
# installs the tools from mise.toml.
#
# GitHub Actions: run it; PATH is persisted through $GITHUB_PATH.
# Other CI shells (Amplify): source it (`. tools/setup-mise.sh`) so the PATH
# export survives into later commands.
#
# POSIX sh only: this file is sourced into whatever shell the caller uses.

MISE_SETUP_VERSION=v2026.10.6

export PATH="$HOME/.local/bin:${MISE_DATA_DIR:-$HOME/.local/share/mise}/shims:$PATH"

install_mise() (
	set -eu

	# Download first so a failed request fails the setup instead of piping
	# nothing into sh.
	installer=$(curl -fsSL https://mise.run)
	printf '%s\n' "$installer" | MISE_VERSION="$MISE_SETUP_VERSION" sh

	if [ -n "${GITHUB_PATH:-}" ]; then
		printf '%s\n' \
			"$HOME/.local/bin" \
			"${MISE_DATA_DIR:-$HOME/.local/share/mise}/shims" >>"$GITHUB_PATH"
	fi

	mise install --locked
)

install_mise
