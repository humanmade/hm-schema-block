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
npm run format          # auto-format JS

# Local environment (WordPress Playground, http://127.0.0.1:9400, Ctrl+C to stop)
npm run playground:start

# E2E tests (Playwright; global-setup.js boots its own Playground on a free port, so runs never collide)
npm run test:e2e                       # override the port with WP_PLAYGROUND_PORT
WP_BASE_URL=http://127.0.0.1:9400 npm run test:e2e   # reuse a running server
npm run test:e2e:watch
npm run patterns:generate              # rewrite patterns/*.html from the real editor (opt-in spec)
npm run demo:record                    # re-record docs/media (demo.mp4, demo.gif, screenshots); needs ffmpeg

# PHP linting (requires composer install)
composer install
vendor/bin/phpcs        # uses .phpcs.xml.dist (WordPress-Core + WordPress-Docs + WordPress-Extra)
```

## Architecture

### PHP layer (`inc/`)

| File | Responsibility |
|------|---------------|
| `namespace.php` | Bootstrap: `bootstrap()` adds the block type filter and `Patterns\bootstrap()` straight away (core blocks register on `init` before plugin callbacks), then hooks `init` + `enqueue_block_editor_assets`; passes `schemaOrgBlocksData` (`schemaTypes`, `schemaProperties`) to JS via `wp_localize_script` |
| `schema-types.php` | `SchemaTypes\get_schema_types()` — full type hierarchy with properties (incl. WebSite, Blog, ItemList, ListItem); filterable via `schema_org_blocks_types` |
| `block-values.php` | `BlockValues\get_attribute()` reads comment attributes and markup-sourced attributes (block.json `source`/`selector`, via the HTML API); `get_text()` reads text from full saved markup, skipping `aria-hidden`, scripts and styles; `get_inner_blocks()` resolves synced patterns and template parts |
| `dynamic-values.php` | `DynamicValues\get_value()` — value of a dynamic block for the post in block context (`postId`, else current post): post title/date/modified (ISO 8601; Modified Date via `core/post-data` binding or `displayType`)/author/featured image/excerpt/terms, site title/tagline/logo; `get_post_field()` and `get_site_field()` back the `post` and `site` mapping sources |
| `block-extensions.php` | `BlockExtensions\register_block_attribute()` — adds the `schemaOrg` attribute to every block via `register_block_type_args` (no block context wiring); `get_config()` normalises it incl. `id`; `extract_schema()` walks a parsed tree passing context down (`get_inner_context()` adds a query block's `query`/`queryId`); `build_entities()` gives one object, or `build_post_items()` one per post for a typed `core/post-template` (query via `build_query_vars_from_query_block`, or the main query when `inherit`; `url` = permalink); `build_schema_object()` = own mappings, then property blocks from `get_property_blocks()` (ancestor walk through untyped containers; stops at typed blocks, property blocks, untyped post templates); repeats become arrays, `itemListElement` values wrapped as `ListItem` with `position`, `coerce_value()` wraps plain values for object-only properties, empty objects dropped, `@id` = home URL + `#id`; `resolve_mapping()` handles the sources |
| `patterns.php` | `Patterns\get_patterns()` lists the 7 patterns (title, description, keywords, `templateTypes`/`blockTypes`); `register_patterns()` registers the "Schema.org" category (`schema-org-blocks`) and reads content from `patterns/<slug>.html` |
| `schema-output.php` | `SchemaOutput\init()` — collects objects per request and emits them: JSON-LD in `wp_head` (hex-escaped), or appended to Yoast's graph via `wpseo_schema_graph`; final graph filterable via `schema_org_blocks_graph` |

Schema data flows: `template_include` starts collection → block themes: `render_block` builds each typed entity block with the `WP_Block` instance's context (`postId`, `query`) as the template renders (before `wp_head`; excerpts and other posts' `the_content` skipped; hidden blocks remove what their inner blocks added) / classic themes: the queried singular post's blocks are parsed with `extract_schema()` and `postId` context → objects de-duplicated by hash → `get_graph()` applies `schema_org_blocks_graph` → `output_json_ld()` or `add_to_yoast_graph()`.

### JS layer (`src/`)

- `src/index.js` — `blocks.registerBlockType` filter adds the `schemaOrg` attribute; the `editor.BlockEdit` HOC finds the parent type with `findParentType()` over the block's ancestors and the claimed properties with `getPropertyCandidates()` under that ancestor, adds the inspector panel, and applies smart defaults from an effect (folded into the inserting undo step via `__unstableMarkNextChangeAsNotPersistent`)
- `src/variations.js` — FAQ and How-to variations of `core/accordion` (inserter scope), built from `PRESETS` plus smart defaults on the inner blocks template
- `src/components/SchemaPresets.js` — Quick setup buttons from `getPresetsFor( blockName )` (group: FAQ, How-to, Article, Organization; accordion: FAQ, How-to; query: Blog, Item list), and "Apply suggested mappings to inner blocks" on any typed block with inner blocks; uses `getTreeDefaults()` (visits blocks one at a time) and one `updateBlockAttributes` call
- `src/components/SchemaTypeSelector.js` — type picker ("Value Type" for property blocks, limited to the object types the property accepts and their subtypes) and the "Map as property of parent" toggle
- `src/components/AttributeMappingControls.js` — `SOURCES` picker: Block attribute, Block text, Inner blocks text, `post:` title/url/date/modified/excerpt/author/image, `site:` name/description/url/logo, `reference:organization` ("Link to site Organization")
- `src/utils/smart-defaults.js` — `RULES` table keyed by block name (`properties` array or function of attributes, `repeatable`, `exceptParentTypes`, `nested`, `build`) incl. post/site blocks and `core/post-template`; per-block `PRESETS` (each with `blocks`) and `getPresetsFor()`; `findParentType()` / `getPropertyCandidates()` mirror the PHP ancestor walk (`stopsWalk()`: typed, property, post template, or `nested` rule blocks); `getSmartDefaults()`, `shouldApplyDefaults()`, `getTreeDefaults()`. Non-repeatable rules apply to the first unconfigured candidate only, while no candidate under the same ancestor claims the property

### Key data shape

The `schemaOrg` block attribute:
```js
{
  type: 'Article',        // schema.org type or null
  id: 'organization',     // optional; site-wide entity, output as "@id": home URL + '#organization'
  mappings: {             // property → source mapping
    headline: { source: 'attribute', attributeName: 'content' },
    name: { source: 'post', field: 'title' },
    publisher: { source: 'reference', id: 'organization' }, // → { "@id": home URL + '#organization' }
    // source: 'attribute' (no attributeName = block text) | 'content' | 'innerBlocks'
    //   | 'post' (field: 'title' | 'url' | 'date' | 'modified' | 'excerpt' | 'author' | 'image')
    //   | 'site' (field: 'name' | 'description' | 'url' | 'logo') | 'reference' (id)
  },
  isProperty: false,      // true when block is a property of its nearest typed ancestor
  propertyName: null,     // e.g. 'image' when isProperty is true
  skipDefaults: true,     // optional; set when the property toggle is turned off, so smart defaults stay off
}
```

A property block with a `type` becomes a nested object; without one its value is its mapping for `propertyName`, or its text (or a dynamic block's value from `DynamicValues`). `post` fields read the post in block context, so inside a query loop they read each post.

### Extending

- **Add schema types**: filter `schema_org_blocks_types` in PHP
- **Change the output**: filter `schema_org_blocks_graph` (array of schema objects) in PHP
- **Modify smart defaults**: add or edit a rule in `RULES` in `src/utils/smart-defaults.js`; presets and variations use the same rules. Add a Quick setup preset to `PRESETS` with the `blocks` that offer it
- **Patterns**: markup in `patterns/<slug>.html`, metadata in `Patterns\get_patterns()`. Never hand-edit the markup; add a case to `PATTERNS` in `tests/e2e/generate-patterns.spec.js` and run `npm run patterns:generate` so it stays editor-serialized. `tests/e2e/patterns.spec.js` checks validity and output
- **Agent skill**: `skills/schema-org-blocks/SKILL.md` (shipped in the plugin zip) teaches agents to annotate patterns and templates; keep it in line with sources, presets and patterns
- **Schema inheritance**: `get_schema_types()` uses a `parent` key; `get_all_properties()` walks the chain to collect inherited properties
