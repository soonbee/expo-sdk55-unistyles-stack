# 06. Smoke scripts

Audience: AI agents reproducing this setup. Prerequisites: `01-cleanup.md` through `05-unistyles.md` applied.

## Context

- Workflow assumption: each ticket closes with a static + bundle gate; a runtime pass on a real dev client binary happens separately before version release.
- Two scripts cover the non-runtime tiers:
  - `smoke:min` — static correctness + Expo config sanity (per-ticket gate, PR check, pre-commit hook candidate)
  - `smoke:full` — everything in `:min` plus an actual iOS Metro bundle export (catches babel-plugin and module-graph regressions before they reach a device build)
- Runtime validation (simulator / dev client binary launch, E2E, etc.) is **intentionally out of scope** of this step. It lives in the release procedure.

## Step 1 — Confirm prerequisites on the target machine

Both scripts rely on tools that are already installed by previous steps:

- `typescript` (dev dep, step 01 → present from the template)
- `eslint` + `eslint-config-expo` + `eslint-config-prettier` (step 04)
- `prettier` (step 03)
- `expo` CLI (template) — provides `expo lint`, `expo export`, and invokes `expo-doctor` on demand via `npx`

No new packages are installed by this step.

Before wiring scripts, sanity-check the two unknowns that could force a different design:

```sh
npx expo-doctor
npx expo export --help
```

Expected on this repo:

- `expo-doctor` → `Running 18 checks on your project... 18/18 checks passed. No issues detected!` If a fresh reproduction lands on a different Expo SDK and any check fails, resolve the check (or configure `"expo": { "doctor": { ... } }` in `package.json`) before depending on it in smoke.
- `expo export --help` must list the flags `--platform`, `--output-dir`, `--no-minify`, `--no-bytecode`. The presence of these flags is what the script below assumes.

## Step 2 — Add the two npm scripts

Append after `format:check` in the `scripts` block of `package.json`:

```json
{
  "scripts": {
    "smoke:min": "tsc --noEmit && npm run lint && npm run format:check && npx expo-doctor",
    "smoke:full": "npm run smoke:min && npx expo export --platform ios --no-minify --no-bytecode --output-dir .expo/smoke-bundle && rm -rf .expo/smoke-bundle"
  }
}
```

Resulting scripts block order:

```json
"scripts": {
  "start": "expo start",
  "android": "expo run:android",
  "ios": "expo run:ios",
  "web": "expo start --web",
  "lint": "expo lint",
  "lint:fix": "expo lint -- --fix",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "smoke:min": "tsc --noEmit && npm run lint && npm run format:check && npx expo-doctor",
  "smoke:full": "npm run smoke:min && npx expo export --platform ios --no-minify --no-bytecode --output-dir .expo/smoke-bundle && rm -rf .expo/smoke-bundle"
}
```

Note: `android` and `ios` commands switched to `expo run:*` after `expo-dev-client` was installed in step 05. That change is not part of this smoke step but appears in the block above for completeness.

## Step 3 — Why these flags

### Static tier (`smoke:min`)

| Check                  | Included because                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit`         | Highest ROI regression catcher. Run first so type errors stop the chain fast.                                                                        |
| `npm run lint`         | `expo-config-expo` rules catch unused vars, bad hooks, missing deps — cheap to run.                                                                  |
| `npm run format:check` | One-second formatter gate; keeps diffs clean and reusable between machines.                                                                          |
| `npx expo-doctor`      | SDK-version / plugin / autolink sanity. Guards against the `expo install` devDep placement bug and similar regressions encountered in earlier steps. |

`tsc` is called inline — no separate `typecheck` script. Reason: it's used only here, so a dedicated script would only add indirection.

### Bundle tier (`smoke:full`)

Extra pass that runs `expo export` after the static tier:

| Flag                              | Why                                                                                                                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--platform ios`                  | Single platform bundle is enough to exercise babel plugins (Unistyles, React Compiler) and the module graph. Three-platform `all` triples the cost with no extra coverage for this use case. |
| `--no-minify`                     | Skip terser minification — it's deterministic and irrelevant for correctness.                                                                                                                |
| `--no-bytecode`                   | Skip Hermes bytecode compilation. Logs a "highly discouraged" warning meant for production builds; harmless here.                                                                            |
| `--output-dir .expo/smoke-bundle` | Write under `.expo/` which is already git-ignored, Prettier-ignored, and ESLint-ignored. No new `.gitignore` entry needed.                                                                   |
| `&& rm -rf .expo/smoke-bundle`    | Post-success cleanup chained with `&&`. On failure the chain breaks before `rm`, so the partially-built bundle is left for debugging.                                                        |

Flags intentionally **not** used:

- `--clear` — clears the Metro bundler cache; hurts repeat-run speed without improving correctness on this code path.
- `--dev` — confusingly named; this configures the **exported static HTML server** for local (non-HTTPS) hosting, not dev-mode bundling. Irrelevant to smoke.
- `--source-maps` — off by default; saves disk and time.

## Step 4 — Run and measure

```sh
time npm run smoke:min
time npm run smoke:full
```

Expected wall-clock on a warm cache (M-series Mac, this repo's size):

| Script       | Time (warm) | What it did                                                             |
| ------------ | ----------- | ----------------------------------------------------------------------- |
| `smoke:min`  | ~7 s        | 4 static checks pass, `18/18` doctor checks pass                        |
| `smoke:full` | ~16 s       | All of `:min` + iOS bundle (~5 s, ~1170 modules, ~4.4 MB), then cleanup |

Cold-cache `smoke:full` (first run after `.expo/metro-cache` wipe) lands around 40–60 s.

Expected exit semantics:

- Any failing check ends the chain. Exit code is whatever tool failed.
- `smoke:full` on success produces no artifacts: the `.expo/smoke-bundle/` directory is deleted as the final step.
- `smoke:full` on bundle failure leaves `.expo/smoke-bundle/` in place with whatever partial output the bundler wrote — useful for inspecting the error.

## Step 5 — Wire into the workflow

This doc does not install git hooks or CI config. Integrations are project-specific; the following are suggested call sites:

| Trigger                          | Script                                                     | Reason                                               |
| -------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| Local pre-commit                 | `smoke:min`                                                | ~7 s; won't derail typing flow.                      |
| Local pre-push / pre-PR          | `smoke:full`                                               | ~15 s; catches babel / plugin regressions before CI. |
| CI on each PR                    | `smoke:full`                                               | Same trade-off scaled to CI time budgets.            |
| Main branch post-merge (nightly) | (optional) automated runtime check — see Notes below       |
| Release cut                      | Manual runtime pass on a dev client binary + any E2E suite |

## Notes for future steps

- **Runtime coverage gap.** Bundle success ≠ runtime success. Native init, `Platform.OS` branches, `StyleSheet.configure` call order, and similar issues only surface on a real binary. If release cadence exceeds ~1 week, add an interim automated runtime check (Detox, Maestro, or a headless EAS Build dev client launch) on a nightly/weekly schedule to shrink the blame window across tickets.
- **Platform expansion.** To bundle Android or web too, add sibling scripts (`smoke:full:android`, `smoke:full:web`) rather than switching `smoke:full` to `--platform all`. Separate scripts give clearer failure localization and let CI parallelize them.
- **Faster `smoke:min`.** If ESLint becomes the slowest link, consider `eslint --cache` via `expo lint -- --cache` (pass-through). Not done here because warm-run lint is already sub-second.
- **`expo-doctor` noise.** If a future SDK upgrade introduces a check that cannot be fixed immediately, disable the specific check via `"expo": { "doctor": { "<checkName>": false } }` in `package.json` rather than dropping `expo-doctor` from `smoke:min`.
- **Cleanup on failure.** Current behavior keeps `.expo/smoke-bundle/` on failure. If accumulated failed-run directories become noisy in `.expo/`, prepend a `rm -rf .expo/smoke-bundle && ` to the export command (pre-clean) at the cost of losing the previous failure state.
- **Hermes bytecode in release build is unchanged.** `--no-bytecode` only affects the smoke export. EAS Build and `expo run:*` still produce bytecode-optimized binaries.
