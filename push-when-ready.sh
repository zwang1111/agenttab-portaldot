#!/usr/bin/env bash
# Push main to github.com/zwang1111/agenttab-portaldot when the remote exists
# and GITHUB_PUSH_TOKEN can access it. Does not create the remote repo.
set -euo pipefail

REPO_SLUG="zwang1111/agenttab-portaldot"
REMOTE_URL="https://github.com/${REPO_SLUG}.git"
BRANCH="main"
OWNER="zwang1111"

die() { echo "ERROR: $*" >&2; exit 1; }

cd "$(dirname "$0")"

[ -n "${GITHUB_PUSH_TOKEN:-}" ] || die "GITHUB_PUSH_TOKEN is unset. Export a fine-grained PAT that includes Contents: write on ${REPO_SLUG}."

# Probe API before touching git remotes (token never printed).
HTTP_CODE=$(curl -sS -o /tmp/portaldot-push-probe.json -w '%{http_code}' \
  -H "Authorization: Bearer ${GITHUB_PUSH_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/${REPO_SLUG}" || true)

MSG=$(python3 -c 'import json; print(json.load(open("/tmp/portaldot-push-probe.json")).get("message",""))' 2>/dev/null || true)
rm -f /tmp/portaldot-push-probe.json

case "$HTTP_CODE" in
  200) echo "OK: ${REPO_SLUG} is reachable." ;;
  401|403)
    die "Auth failed (HTTP ${HTTP_CODE}: ${MSG:-unknown}). Check GITHUB_PUSH_TOKEN and that ${REPO_SLUG} is in the fine-grained token repository access list."
    ;;
  404)
    die "Repo not found or not in token scope (HTTP 404). Create https://github.com/${REPO_SLUG} first, then add it to the fine-grained PAT repository access (Contents: write)."
    ;;
  *)
    die "Unexpected GitHub API response HTTP ${HTTP_CODE}: ${MSG:-no message}"
    ;;
esac

# Credential helper: askpass reads username/password from env; never writes token to disk or remote URL.
ASKPASS=$(mktemp)
chmod 700 "$ASKPASS"
trap 'rm -f "$ASKPASS"' EXIT
cat > "$ASKPASS" << 'ASK'
#!/usr/bin/env bash
case "$1" in
  *Username*) echo "$GIT_ASKPASS_USER" ;;
  *Password*) echo "$GITHUB_PUSH_TOKEN" ;;
  *) echo "" ;;
esac
ASK
chmod 700 "$ASKPASS"

export GIT_ASKPASS="$ASKPASS"
export GIT_ASKPASS_USER="x-access-token"
export GIT_TERMINAL_PROMPT=0

# Origin URL has no embedded token (avoids leaking into .git/config / logs).
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

echo "Pushing ${BRANCH} -> origin (${REMOTE_URL})"
# Prefer upstream set; first push may need -u
if ! git push -u origin "$BRANCH" 2> >(tee /tmp/portaldot-push.err >&2); then
  ERR=$(cat /tmp/portaldot-push.err 2>/dev/null || true)
  rm -f /tmp/portaldot-push.err
  if echo "$ERR" | grep -qiE '404|not found|does not exist'; then
    die "Push failed: remote missing or not in token scope. Create the repo and grant the PAT access to ${REPO_SLUG}."
  fi
  if echo "$ERR" | grep -qiE 'Authentication failed|403|denied|invalid credentials|Write access'; then
    die "Push auth failed. Add ${REPO_SLUG} to the fine-grained token with Contents: write."
  fi
  die "git push failed. See error above."
fi
rm -f /tmp/portaldot-push.err

echo "Done: ${BRANCH} pushed to ${REMOTE_URL}"
