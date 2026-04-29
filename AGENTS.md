# Codex Agent Guidelines

Use this prompt as the shared operating agreement for Codex agents working on this repo during the hackathon.

You are collaborating with multiple developers and need to move fast. Favor small, direct changes and avoid process overhead unless it prevents a real collision.

## Worktrees and Branches

- Do not edit another developer's active worktree.
- Create a quick dedicated worktree per task:
  `git worktree add ../openai-sydney-hackaton-<short-task> -b codex/<short-task> origin/main`
- Use short branch names, preferably `codex/<short-task>`.
- Before starting, run `git status --short --branch` and `git fetch origin`.
- Pull/rebase from `origin/main` when the branch is old or before merging to `main`.
- Never use destructive commands such as `git reset --hard`, `git clean -fd`, or `git checkout -- .` unless the user explicitly asks.
- Do not revert changes you did not make. If unrelated changes exist, leave them alone.

## Development Practice

- Read just enough surrounding code and docs to avoid breaking the app.
- Prefer existing app patterns over new abstractions.
- Keep commits focused, but do not over-polish.
- The default preview path should stay regular Expo:
  `npm start -- -c`
- Use web preview for fast UI checks:
  `npm run web -- -c`
- Use the dev-client path only when testing native Health Connect / HealthKit behavior:
  `npm run start:dev-client -- -c`
- For Health Connect or native permission changes, remember that Android needs a rebuild/reinstall, not just a JS reload.
- If native modules, config plugins, Android permissions, or iOS entitlements change, rebuild with `npx expo run:android` or the matching platform command before expecting device behavior to update.
- Keep local-only secrets out of git. API keys must use secure device storage or environment variables.
- Preserve raw health data in the pipeline; dedupe or aggregate in derived views/tables unless explicitly changing storage semantics.
- When adding pipeline fields, update types, SQLite persistence, exports, UI consumers, and diagnostics together.

## Running and Preview Gotchas

- `npm start -- -c` is for regular Expo preview. It can run in Expo Go, but Expo Go cannot load native modules such as `react-native-health-connect`.
- `npm run web -- -c` is for fast UI/layout checks only. Web preview does not exercise Health Connect, HealthKit, SecureStore, native permissions, or device-only behavior.
- Use `npm run start:dev-client -- --localhost -c` with a previously installed dev build when testing native device behavior over USB. Run `adb reverse tcp:8081 tcp:8081` first when the Android device cannot reach the Mac over LAN.
- Build or reinstall the Android dev client with `npx expo run:android` when native dependencies, app config, permissions, or package names change. A JS reload is not enough for those changes.
- If `npx expo run:android` cannot find Java or the Android SDK, set `JAVA_HOME`, `ANDROID_HOME`, and `ANDROID_SDK_ROOT` locally. `android/local.properties` may point at the local SDK path and must stay uncommitted.
- OpenAI API keys from `.env` must use `EXPO_PUBLIC_OPENAI_API_KEY`. Restart Metro with `-c` after changing `.env`; otherwise the running bundle may still see the old environment.
- If the app shows an Expo Go native-module error, rebuild/open the dev client app instead of Expo Go. The URL should use the app scheme dev-client route, not the generic Expo Go experience.

## Verification

- Run `npm run typecheck` before merging TypeScript changes when time allows; at minimum run it before pushing to `main`.
- Run `git diff --check` before pushing.
- For mobile UI changes, reload the app through Metro and verify the affected screen on device when possible.
- If adding native modules or manifest permissions, run/rebuild with `npx expo run:android` or the matching platform command.

## Git Handoff

- Use `git status --short --branch` before committing.
- Commit with a concise imperative message.
- Push `main` when the user asks; otherwise push a task branch if useful for handoff.
- In final handoff, state the branch, commit hash, and tests run.
