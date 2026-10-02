# Contributing to Schema.org Blocks

Thank you for your interest in contributing to Schema.org Blocks! This document provides guidelines and instructions for contributing.

## Development Setup

1. **Clone the repository**
```bash
git clone https://github.com/humanmade/hm-schema-block.git
cd hm-schema-block
```

2. **Install dependencies**
```bash
npm install
composer install
```

3. **Start development environment**
```bash
npm run playground:start
```

This starts WordPress Playground at http://127.0.0.1:9400 with the plugin mounted and active. Stop it with Ctrl+C.

4. **Start build watcher**
```bash
npm start
```

## Development Workflow

### Code Style

We follow WordPress coding standards:

- **JavaScript**: Run `npm run lint:js` to check for issues
- **Formatting**: Run `npm run format` to auto-format code

### Testing

Before submitting a pull request:

1. Run e2e tests:
```bash
npm run test:e2e
```

The test run boots its own Playground instance on a free port the system picks, so parallel runs never collide, even in the same checkout. Give each parallel run in one checkout its own `--output` folder. Set `WP_PLAYGROUND_PORT` to choose the port, or set `WP_BASE_URL` to run against a server that is already running.

2. Manually test in the browser at http://127.0.0.1:9400 (after `npm run playground:start`)

### Demo video and screenshots

The demo video, the README GIF and the screenshots in `docs/media/` come from an opt-in spec. After a UI change, run `npm run build` and then `npm run demo:record` to record them again. It needs ffmpeg on your PATH, takes about three minutes, and overwrites the files in `docs/media/`; check the new video before you commit it.

### Building

To build production assets:
```bash
npm run build
```

## Project Structure

```
hm-schema-block/
├── inc/                          # PHP includes
│   ├── namespace.php            # Plugin bootstrap
│   ├── schema-types.php         # Schema.org type definitions
│   ├── block-values.php         # Read attributes and text from block markup
│   ├── block-extensions.php     # schemaOrg attribute, schema object builder (ancestor walk, query loops)
│   ├── dynamic-values.php       # Values of dynamic blocks, post fields and site fields
│   ├── patterns.php             # Registers the Schema.org pattern category and patterns
│   └── schema-output.php        # Collection during render, JSON-LD and Yoast output
├── patterns/                     # Block pattern markup, one .html file per pattern
├── skills/
│   └── schema-org-blocks/SKILL.md  # Agent skill for annotating patterns and templates
├── src/                          # JavaScript source
│   ├── index.js                 # Main entry point
│   ├── variations.js            # FAQ and How-to accordion variations
│   ├── components/              # React components
│   │   ├── SchemaTypeSelector.js
│   │   ├── AttributeMappingControls.js
│   │   └── SchemaPresets.js     # Quick setup buttons
│   ├── utils/                   # Utility functions
│   │   └── smart-defaults.js    # Smart default rules and presets
│   └── editor.scss              # Editor styles
├── tests/                        # Test files
│   └── e2e/                     # Playwright e2e tests
└── build/                        # Compiled assets (generated)
```

## Adding Features

### Adding New Schema Types

Edit `inc/schema-types.php` and add to the `get_schema_types()` function:

```php
'NewType' => [
    'label' => 'New Type',
    'parent' => 'Thing',
    'properties' => [
        'propertyName' => [
            'type' => 'Text',
            'label' => 'Property Name'
        ],
    ],
],
```

### Adding Smart Defaults for Blocks

Edit `src/utils/smart-defaults.js` and add a rule to the `RULES` table, keyed by block name:

```javascript
'core/my-block': {
    // Candidate parent properties; the first one the parent type has is used.
    properties: [ 'someProperty' ],
    // Optional: apply to every sibling, not just the first unconfigured one.
    repeatable: false,
    // Optional: parent types the rule does not apply in.
    exceptParentTypes: [ 'Question' ],
    // Optional: build the schemaOrg value. Without it the block is an untyped property.
    build: ( propertyName ) => ( {
        type: null,
        isProperty: true,
        propertyName,
        mappings: {
            [ propertyName ]: {
                source: 'attribute',
                attributeName: 'myAttribute',
            },
        },
    } ),
},
```

The same rules drive defaults on insert, the Quick setup presets and the FAQ and How-to variations.

### Adding or Changing Patterns

Patterns live in `patterns/*.html`, one file per pattern. `inc/patterns.php` registers them in the "Schema.org" category. Its `get_patterns()` list holds each pattern's title, description, keywords, and where it is offered (`templateTypes` or `blockTypes`). The file name without `.html` is the pattern slug.

Keep the markup exactly as the editor serializes it. If it differs, the blocks load as invalid. Do not write or edit pattern markup by hand. Regenerate it from the real editor instead:

```bash
npm run patterns:generate
```

This runs `tests/e2e/generate-patterns.spec.js`. It builds each pattern from plain blocks, applies Quick setup like a user would, and saves the editor's content to `patterns/`. To add a pattern, add an entry to `PATTERNS` in that file (the blocks, the Quick setup button to click, and any extra mappings) and an entry to `get_patterns()`. Generate on the oldest supported WordPress version, so newer versions load the patterns through their own deprecations.

`tests/e2e/patterns.spec.js` tests every pattern. It checks that the pattern loads in the editor with no invalid blocks, and that a published post outputs the expected graph. Update its expectations when you change a pattern.

If a pattern changes how to annotate blocks, update `skills/schema-org-blocks/SKILL.md` too.

### Adding New UI Components

1. Create component in `src/components/`
2. Import and use in `src/index.js`
3. Add styles to `src/editor.scss`

## Testing Guidelines

### E2E Tests

Write tests for:
- User interactions in the block editor
- Schema type selection
- Attribute mapping
- Smart defaults application
- Property blocks and their nearest typed ancestor
- Pattern and template output

Example test structure:
```javascript
test( 'should do something', async ( { editor, page } ) => {
    // Arrange
    await editor.insertBlock( { name: 'core/group' } );

    // Act
    await page.getByRole( 'button', { name: 'Schema.org Mapping' } ).click();
    await page.getByLabel( 'Schema Type' ).selectOption( 'Article' );

    // Assert
    await expect( page.getByText( 'Schema Property Mapping' ) ).toBeVisible();
} );
```

## Pull Request Process

1. **Fork the repository** and create a feature branch
2. **Make your changes** following code style guidelines
3. **Add tests** for new features
4. **Update documentation** if needed
5. **Run tests** to ensure nothing breaks
6. **Submit a pull request** with a clear description

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Tests pass locally
- [ ] Documentation updated
```

## Code Review

All submissions require review. We aim to review PRs within 5 business days.

Reviewers will check for:
- Code quality and style
- Test coverage
- Documentation
- Backwards compatibility
- Performance impact

## Questions?

Feel free to open an issue for:
- Bug reports
- Feature requests
- Questions about contributing

## License

By contributing, you agree that your contributions will be licensed under the GPL-2.0-or-later license.
