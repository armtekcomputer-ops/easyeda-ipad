# Repository instructions

## Required multi-chat workflow

Before work, read remote main `HANDOFF.md` and `WORKBOARD.md`, then current main and open PRs. Branch-local copies can be stale.

Follow WORKBOARD.md's atomic SHA-based claim protocol before implementation. Register a unique chat ID, reserve exact write paths, confirm ownership remotely, and use a separate task branch/worktree. Refresh before editing, pushing, expanding scope, resuming or integrating. Do not write files reserved by another task; pick independent work or reconcile ownership.

Publish milestones, blockers, remaining work, branch/head/PR and the next action. Expired leases require reconciliation, not blind takeover. A resumed former owner must stop if ownership changed.

WORKBOARD.md on main is canonical for coordination; never merge a stale board from a feature branch. Shared HANDOFF/README/version/config edits also require coordination. Preserve other chats' records and re-fetch on conflicts. Never force-push main.

HANDOFF.md describes verified product state; open PRs are not merged capabilities. Historical review-only instructions apply to their original task; honor the latest user's scope. Coordination does not authorize unrelated implementation, merging or deployment.

Maintain existing EasyEDA API validation and safety requirements in HANDOFF.md. Record checks and tested commit; do not claim live-device validation from CI alone.
