# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (90-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk vitest run          # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->

---

## Project Overview

WordPress plugin (`SchemaOrgBlocks` namespace) that extends the block editor to add schema.org type mapping and structured data output to all blocks. Schema data is emitted as JSON-LD (or merged into Yoast SEO's graph when Yoast is active).

## Commands

```bash
# JS build
npm run build           # production build → build/
npm start               # watch mode

# Linting
npm run lint:js         # ESLint via wp-scripts
npm run format:js       # auto-format JS

# Local environment (wp-env, port 8888)
npm run env:start
npm run env:stop

# E2E tests (Playwright, runs against port 8889)
npm run test:e2e
npm run test:e2e:watch

# PHP linting (requires composer install)
composer install
vendor/bin/phpcs        # uses .phpcs.xml.dist (WordPress-Core + WordPress-Docs + WordPress-Extra)
```

## Architecture

### PHP layer (`inc/`)

| File | Responsibility |
|------|---------------|
| `namespace.php` | Bootstrap (`bootstrap()` → hooks `init` + `enqueue_block_editor_assets`); passes `schemaOrgBlocksData` to JS via `wp_localize_script` |
| `schema-types.php` | `SchemaTypes\get_schema_types()` — full type hierarchy with properties; filterable via `schema_org_blocks_types` |
| `block-extensions.php` | `BlockExtensions\register_block_context()` — adds `schemaOrg` attribute to every block via `register_block_type_args`; extracts schema data during `render_block` into global `$schema_org_blocks_data` |
| `schema-output.php` | `SchemaOutput\init()` — outputs collected data as JSON-LD in `wp_head` (or merges into Yoast's graph via `wpseo_schema_graph_pieces`) |

Schema data flows: block renders → `extract_schema_data` populates `$schema_org_blocks_data` → `output_json_ld` / `add_to_yoast_schema` emits it.

### JS layer (`src/`)

- `src/index.js` — two `addFilter` calls: (1) `blocks.registerBlockType` adds `schemaOrg` attribute + context wiring, (2) `editor.BlockEdit` wraps every block with inspector controls via HOC
- `src/components/SchemaTypeSelector.js` — dropdown to pick schema type; supports subtype narrowing and property-of-parent mode
- `src/components/AttributeMappingControls.js` — maps block attributes/content to schema properties
- `src/utils/smart-defaults.js` — auto-applies sensible mappings for `core/image`, `core/button`, `core/heading`, `core/paragraph` when inside a schema-typed parent

### Key data shape

The `schemaOrg` block attribute:
```js
{
  type: 'Article',        // schema.org type or null
  mappings: {             // property → source mapping
    headline: { source: 'attribute', attributeName: 'content' }
  },
  isProperty: false,      // true when block is a property of parent, not a standalone type
  propertyName: null,     // e.g. 'image' when isProperty is true
}
```

### Extending

- **Add schema types**: filter `schema_org_blocks_types` in PHP
- **Modify smart defaults**: edit `src/utils/smart-defaults.js`
- **Schema inheritance**: `get_schema_types()` uses a `parent` key; `get_all_properties()` walks the chain to collect inherited properties
