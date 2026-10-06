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
composer lint           # phpcs, uses .phpcs.xml.dist (WordPress-Core + WordPress-Docs + WordPress-Extra + PHPCompatibilityWP)
composer format         # phpcbf, auto-fix what it can
```

## Architecture

### PHP layer (`inc/`)

| File | Responsibility |
|------|---------------|
| `namespace.php` | Bootstrap: `bootstrap()` adds the block type filter and `Patterns\bootstrap()` straight away (core blocks register on `init` before plugin callbacks), then hooks `init` + `enqueue_block_editor_assets`; passes `schemaOrgBlocksData` (`schemaTypes`, `schemaProperties`) to JS via `wp_localize_script` |
| `schema-types.php` | `SchemaTypes\get_schema_types()` — full type hierarchy with properties (incl. WebSite, Blog, ItemList, ListItem); filterable via `schema_org_blocks_types`; a `required` key per type (Google rich result requirements plus article author/publisher; an array entry means any one of) and `get_required_properties()` resolves it down the `parent` chain (`schemaRequired` in `schemaOrgBlocksData`) |
| `block-values.php` | `BlockValues\get_attribute()` reads comment attributes and markup-sourced attributes (block.json `source`/`selector`, via the HTML API); `get_text()` reads text from full saved markup, skipping `aria-hidden`, scripts and styles; `get_inner_blocks()` resolves synced patterns and template parts |
| `dynamic-values.php` | `DynamicValues\get_value()` — value of a dynamic block for the post in block context (`postId`, else current post): post title/date/modified (ISO 8601; Modified Date via `core/post-data` binding or `displayType`)/author/featured image/excerpt/terms, site title/tagline/logo; `get_post_field()` and `get_site_field()` back the `post` and `site` mapping sources; `get_breadcrumb_items()` renders a `core/breadcrumbs` block for its context (adding `postType`, with a guard against re-entry from `render_block`) and reads its `<li>`s with the HTML processor into `ListItem`s (`name` = visible text, `item` = link, or the post permalink for a last entry with no link) |
| `block-extensions.php` | `BlockExtensions\register_block_attribute()` — adds the `schemaOrg` attribute to every block via `register_block_type_args` (no block context wiring); `get_default_config()` is the per-block default (`core/breadcrumbs` is a `BreadcrumbList`) used as the attribute default and by `get_config()` when no `schemaOrg` is saved (a saved one, even with a null type, wins); `get_config()` normalises it incl. `id`; `extract_schema()` walks a parsed tree passing context down (`get_inner_context()` adds a query block's `query`/`queryId`); `build_entities()` gives one object, or `build_post_items()` one per post for a typed `core/post-template` (query via `build_query_vars_from_query_block`, or the main query when `inherit`; `url` = permalink); `build_schema_object()` = own mappings, then property blocks from `get_property_blocks()` (ancestor walk through untyped containers; stops at typed blocks, property blocks, untyped post templates); repeats become arrays, `itemListElement` values wrapped as `ListItem` with `position` (a breadcrumbs block fills it from its trail via `add_breadcrumb_items()`, with `@id` = permalink + `#breadcrumb`), `coerce_value()` wraps plain values for object-only properties, empty objects dropped, `@id` = home URL + `#id`; `fill_inferred()` fills Article (and subtype) properties still unset after mappings and property blocks from the post in context (headline, dates, image, publisher reference to `#organization`, author Person); `resolve_mapping()` handles the sources |
| `patterns.php` | `Patterns\get_patterns()` lists the 7 patterns (title, description, keywords, `templateTypes`/`blockTypes`); `register_patterns()` registers the "Schema.org" category (`schema-org-blocks`) and reads content from `patterns/<slug>.html` |
| `abilities.php` | `Abilities\bootstrap()` registers the `schema-org-blocks` category and three read-only, REST- and MCP-public abilities: `get-guidance` returns SKILL.md (without frontmatter) plus every pattern's markup; `get-schema-types` lists the types, or one type with its inherited properties and subtypes; `get-schema-graph` returns the JSON-LD graph of a same-site `url` or published `post_id` fetched from the rendered page, or builds it from `content` (or a draft's blocks) with `extract_schema()` and `SchemaOutput\build_graph()` (with a post id the graph includes its WebPage node), without template entities unless `with_template` is set (block theme, `content` + `post_id`: the post's template is walked with `content` standing in for `core/post-content` via `BlockValues\set_post_content_blocks()`); every result has `missing` from `SchemaOutput\get_missing()`; `register_graph_route()` adds `POST schema-org-blocks/v1/graph` (`content`, `post_id`, `with_template`) for the editor, because the read-only ability only takes GET and the content would not fit in the URL |
| `schema-output.php` | `SchemaOutput\init()` — collects objects per request and emits them: JSON-LD in `wp_head` (hex-escaped), or merged into Yoast's graph via `wpseo_schema_graph`; `build_graph( $objects, $post_id )` runs the post-processing; `assemble_page()` joins the nodes into one page (WebPage hub: found by `@id`/`url` or added; page subtypes such as FAQPage merged into it; main entities the page type does not accept moved to `hasPart`; a lone entity linked as `mainEntity`/`mainEntityOfPage`, never a BreadcrumbList; the first top-level BreadcrumbList with an `@id` becomes the hub's `breadcrumb` when it has none; other top-level creative works get `isPartOf` the page); `add_to_yoast_graph()` drops our BreadcrumbList when Yoast's graph has one or its page node has `breadcrumb`; `get_missing()` lists required properties no node sets (never output on the front end); final graph filterable via `schema_org_blocks_graph` |

Schema data flows: `template_include` starts collection → block themes: `render_block` builds each typed entity block with the `WP_Block` instance's context (`postId`, `query`) as the template renders (before `wp_head`; excerpts and other posts' `the_content` skipped; hidden blocks remove what their inner blocks added) / classic themes: the queried singular post's blocks are parsed with `extract_schema()` and `postId` context → objects de-duplicated by hash → `get_graph()` runs `build_graph()` (nested duplicates removed → `assemble_page()` on singular pages → repeated entities linked by `@id` → WebSite/Organization added if referenced, non-Yoast → `schema_org_blocks_graph`) → `output_json_ld()`. With Yoast, `add_to_yoast_graph()` merges the block objects into Yoast's graph and runs `assemble_page()` with Yoast's WebPage as the hub, so an FAQ block makes it `["WebPage", "FAQPage"]`.

### JS layer (`src/`)

- `src/index.js` — `blocks.registerBlockType` filter adds the `schemaOrg` attribute (with the type from `DEFAULT_TYPES`, e.g. `core/breadcrumbs` → `BreadcrumbList`, mirroring PHP's `get_default_config()`); the `editor.BlockEdit` HOC finds the parent type with `findParentType()` over the block's ancestors and the claimed properties with `getPropertyCandidates()` under that ancestor, adds the "Schema.org" panel (presets, type and property pickers in a `VStack`), the "Schema.org properties" `ToolsPanel` (typed blocks) and the entity controls in the `advanced` inspector group, and applies smart defaults from an effect (folded into the inserting undo step via `__unstableMarkNextChangeAsNotPersistent`)
- `src/variations.js` — FAQ and How-to variations of `core/accordion` (inserter scope), built from `PRESETS` plus smart defaults on the inner blocks template
- `src/pre-publish.js` — `PluginPrePublishPanel` "Schema.org": when the publish panel opens it POSTs the edited content, post ID and `with_template` to `/schema-org-blocks/v1/graph`, then lists the `missing` properties or says all is set; never blocks publishing
- `src/components/SchemaPresets.js` — Quick setup buttons from `getPresetsFor( blockName )` (group: FAQ, How-to, Article, Organization; accordion: FAQ, How-to; query: Blog, Item list), and "Apply suggested mappings to inner blocks" on any typed block with inner blocks; uses `getTreeDefaults()` (visits blocks one at a time) and one `updateBlockAttributes` call
- `src/components/SchemaTypeSelector.js` — the "Use as a property of {parent type}" toggle, "Property Name" (a typed block is offered only parent properties that accept its type; a single one shows as read-only text and is picked when the toggle turns on) and the type picker: a searchable `ComboboxControl` "Schema Type" for top-level blocks, "Value Type" for property blocks limited to the object types the property accepts and their subtypes (`ToggleGroupControl` for three or fewer options including None, else `SelectControl`; a property that accepts one object type and no data types shows it as read-only text, and `getLockedValueType()` lets `onPropertyChange` in `index.js` set it)
- `src/components/EntityControls.js` — "Entity ID" and "Nest inner entities as", rendered in the block's Advanced panel; exports `DATA_TYPES` and `toEntityId()`
- `src/components/AttributeMappingControls.js` — a `ToolsPanel` "Schema.org properties": each unclaimed property of the type is a `ToolsPanelItem` (shown while mapped; the panel menu adds or removes it, "Reset all" clears the mappings) holding its `SOURCES` picker: Block attribute, Block text, Inner blocks text, `post:` title/url/date/modified/excerpt/author/image, `site:` name/description/url/logo, `reference:organization` ("Link to site Organization")
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
- **Agent skill**: `skills/schema-org-blocks/SKILL.md` (shipped in the plugin zip) teaches agents to annotate patterns and templates, and the `schema-org-blocks/get-guidance` ability serves it (without frontmatter) plus the pattern markup; keep them in line with sources, presets and patterns
- **Schema inheritance**: `get_schema_types()` uses a `parent` key; `get_all_properties()` walks the chain to collect inherited properties
