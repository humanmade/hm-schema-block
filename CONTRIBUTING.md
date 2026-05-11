# Contributing to Schema.org Blocks

Thank you for your interest in contributing to Schema.org Blocks! This document provides guidelines and instructions for contributing.

## Development Setup

1. **Clone the repository**
```bash
git clone https://github.com/humanmade/schema-org-blocks.git
cd schema-org-blocks
```

2. **Install dependencies**
```bash
npm install
composer install
```

3. **Start development environment**
```bash
npm run env:start
```

4. **Start build watcher**
```bash
npm start
```

## Development Workflow

### Code Style

We follow WordPress coding standards:

- **JavaScript**: Run `npm run lint:js` to check for issues
- **Formatting**: Run `npm run format:js` to auto-format code

### Testing

Before submitting a pull request:

1. Run e2e tests:
```bash
npm run test:e2e
```

2. Manually test in the browser at http://localhost:8889

### Building

To build production assets:
```bash
npm run build
```

## Project Structure

```
schema-org-blocks/
├── inc/                          # PHP includes
│   ├── namespace.php            # Plugin bootstrap
│   ├── schema-types.php         # Schema.org type definitions
│   ├── block-extensions.php     # Block attribute/context registration
│   └── schema-output.php        # JSON-LD output handling
├── src/                          # JavaScript source
│   ├── index.js                 # Main entry point
│   ├── components/              # React components
│   │   ├── SchemaTypeSelector.js
│   │   └── AttributeMappingControls.js
│   ├── utils/                   # Utility functions
│   │   └── smart-defaults.js
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

Edit `src/utils/smart-defaults.js` and add logic in the `getSmartDefaults()` function:

```javascript
if ( blockName === 'core/my-block' ) {
    // Return default configuration
    return {
        type: null,
        isProperty: true,
        propertyName: 'someProperty',
        mappings: {
            someProperty: {
                source: 'attribute',
                attributeName: 'myAttribute',
            },
        },
    };
}
```

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
- Parent/child context relationships

Example test structure:
```javascript
test( 'should do something', async ( { editor, page } ) => {
    // Arrange
    await editor.insertBlock( { name: 'core/group' } );

    // Act
    await page.getByRole( 'button', { name: 'Schema.org Mapping' } ).click();
    await page.getByLabel( 'Schema Type' ).selectOption( 'Article' );

    // Assert
    await expect( page.getByText( 'Attribute Mappings' ) ).toBeVisible();
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
