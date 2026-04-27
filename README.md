# expo-sdk55-unistyles-stack

A Claude Code skill that scaffolds a new Expo SDK 55 React Native project with an opinionated stack: **Unistyles v3**, **ESLint 9 flat config + eslint-config-prettier**, **Prettier 3**, **expo-dev-client**, **smoke scripts**, **web target disabled** (Tier 3).

The skill invokes `create-expo-app` with `--template default@sdk-55`, applies a verbatim file overlay, then substitutes identity fields (`projectName`, `displayName`, `bundleId`).

## Install

Clone into your Claude Code user-skills directory:

```sh
git clone https://github.com/<your-handle>/expo-sdk55-unistyles-stack.git \
  ~/.claude/skills/expo-sdk55-unistyles-stack
```

Restart Claude Code (or run `/skills`) to pick up the new skill.

## Trigger

Invoke this skill by asking Claude Code to scaffold a project with this stack, e.g.:

- "Create a new Expo project with the expo-sdk55-unistyles-stack skill"
- "Scaffold a fresh project with our standard stack"
- "이 stack으로 새 프로젝트 만들어줘"

Claude collects three inputs before any filesystem action:

| Input         | Format                            | Used for                                                |
| ------------- | --------------------------------- | ------------------------------------------------------- |
| `projectName` | kebab-case (`^[a-z][a-z0-9-]*$`)  | dir name, `package.json.name`, `app.json.slug`/`scheme` |
| `displayName` | free text                         | `app.json.name`                                         |
| `bundleId`    | reverse-domain (`com.acme.myapp`) | `ios.bundleIdentifier`, `android.package`               |

## Repo layout

```
expo-sdk55-unistyles-stack/
├── SKILL.md             # skill entry point — read by Claude at runtime
├── recipe/              # source-of-truth: hand-written reproduction record
│   ├── 01-cleanup.md
│   ├── 02-disable-web.md
│   ├── 03-prettier.md
│   ├── 04-eslint.md
│   ├── 05-unistyles.md
│   └── 06-smoke.md
└── overlay/             # scaffold payload — copied verbatim into new projects
    ├── .prettierrc, .prettierignore
    ├── babel.config.js, eslint.config.js
    ├── index.ts
    └── src/{unistyles.ts, app/}
```

**Lineage**: `recipe/` is the human-written reproduction guide — the source of truth for *why* the stack looks the way it does. `SKILL.md` + `overlay/` are the *automated* derivative: SKILL.md scripts the steps, `overlay/` ships the static config files. When `recipe/` changes, `SKILL.md` and `overlay/` must be re-synced manually (no auto-sync).

## Stack contents

- **Expo SDK 55** (pinned via `--template default@sdk-55`)
- **expo-router** (kept from template)
- **Unistyles v3** with `react-native-nitro-modules`
- **expo-dev-client**
- **ESLint 9 flat config** + `eslint-config-expo` + `eslint-config-prettier`
- **Prettier 3** (exact version)
- `smoke:min` (TS + lint + format check + expo-doctor) and `smoke` (`:min` + iOS bundle export)
- Web target disabled — `react-dom`, `react-native-web` removed; `app.json` `web` block dropped; `platforms: ["ios", "android"]` added

## Updating the skill

When `recipe/*.md` changes:

1. Re-do the manual reproduction in a scratch directory following the new recipe
2. Diff its config files against `overlay/` and copy any drift back
3. Update `SKILL.md` execution steps for any flow changes
4. Bump the SDK pin in Step 1 if the recipe targets a new SDK

See `SKILL.md` "Notes for future maintenance of this skill" for caveats.
