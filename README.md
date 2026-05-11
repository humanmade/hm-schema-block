# Schema.org Blocks

A WordPress plugin that extends all blocks with schema.org type mapping and structured data output.

<a href="https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/humanmade/hm-schema-block/main/blueprint.json"><img src="https://raw.githubusercontent.com/adamziel/playground-preview/refs/heads/trunk/assets/playground-preview-button.svg" width="224" height="52" alt="Open in WordPress Playground"></a>

## Features

- 🎯 **Universal Block Extension**: Adds schema.org mapping to all WordPress blocks
- 🔗 **Block Context Support**: Blocks can provide and consume schema types from parent/child relationships
- 🎨 **Smart Defaults**: Automatic mapping for common blocks (image, button, heading, paragraph)
- 🌳 **Hierarchical Types**: Support for nested schema types (e.g., Place > Accommodation > Room)
- 🔄 **Flexible Property Mapping**: Map block attributes or content to schema properties
- 🚀 **Yoast SEO Integration**: Extends Yoast's schema output when available
- 📊 **JSON-LD Fallback**: Automatic JSON-LD output when Yoast is not installed

## Installation

1. Clone this repository to your WordPress plugins directory:
```bash
cd wp-content/plugins
git clone https://github.com/humanmade/schema-org-blocks.git
cd schema-org-blocks
```

2. Install dependencies:
```bash
npm install
composer install
```

3. Build the plugin:
```bash
npm run build
```

4. Activate the plugin in WordPress admin.

## Development

### Local Development with wp-env

Start the development environment:
```bash
npm run env:start
```

Start the build watcher:
```bash
npm start
```

Access your development site at http://localhost:8888

### Testing

Run Playwright e2e tests:
```bash
npm run test:e2e
```

Watch mode for tests:
```bash
npm run test:e2e:watch
```

### Code Quality

Lint JavaScript:
```bash
npm run lint:js
```

Format JavaScript:
```bash
npm run format:js
```

## Usage

### Basic Schema Type Mapping

1. Edit any post or page in the block editor
2. Select a block (e.g., a Group or Container block)
3. In the block inspector, open the "Schema.org Mapping" panel
4. Select a schema type (e.g., "Article", "Organization", "Place")
5. Configure attribute mappings to map block attributes to schema properties

### Hierarchical Schema Types

When a parent block has a schema type, child blocks can:

1. **Inherit the parent type**: Leave schema type empty to use parent's type
2. **Narrow down to a subtype**: Select a valid subtype (e.g., Accommodation → Room)
3. **Map as a property**: Set the block as a specific property of the parent schema object

### Smart Defaults

The plugin automatically configures common blocks when they're nested within a block that has schema context:

- **core/image**: Auto-maps to `image` property as `ImageObject`
- **core/button**: Auto-maps to `url` properties
- **core/heading**: Auto-maps to `headline` or `name` properties
- **core/paragraph**: Auto-maps to `description`, `text`, or `articleBody` properties

### Example: Article with Schema

```
Group (Article)
├── Heading (→ headline property)
├── Paragraph (→ articleBody property)
├── Image (→ image property as ImageObject)
│   ├── URL → contentUrl
│   ├── Caption → caption
│   └── Dimensions → width/height
└── Button (→ url property)
```

### Complex Property Mapping

For properties that can accept multiple types (e.g., `image` can be `ImageObject` or `URL`):

1. Child blocks can be set as the property itself
2. If the property type is a complex object (like `ImageObject`), map child block attributes to that object's properties
3. If the property type is simple (like `URL`), map directly to that value

## Schema Types

The plugin includes comprehensive schema.org type definitions including:

- **Creative Works**: Article, BlogPosting, NewsArticle, CreativeWork
- **Organizations**: Organization, LocalBusiness
- **People**: Person
- **Places**: Place, Accommodation, Room
- **Products**: Product
- **Events**: Event
- **Media**: ImageObject, MediaObject
- **Structured Values**: PostalAddress, GeoCoordinates, Offer, Review, Rating

All types support inheritance, so properties from parent types are automatically available.

## Extending the Plugin

### Adding Custom Schema Types

Use the `schema_org_blocks_types` filter:

```php
add_filter( 'schema_org_blocks_types', function( $types ) {
    $types['CustomType'] = [
        'label' => 'Custom Type',
        'parent' => 'Thing',
        'properties' => [
            'customProperty' => [
                'type' => 'Text',
                'label' => 'Custom Property'
            ],
        ],
    ];
    return $types;
} );
```

### Modifying Smart Defaults

Smart defaults are determined in `src/utils/smart-defaults.js`. You can modify the logic or add support for custom block types.

## Output

### With Yoast SEO

When Yoast SEO is active, schema data is added to Yoast's schema graph using the `wpseo_schema_graph_pieces` filter.

### Without Yoast SEO

Schema data is output as JSON-LD in the site header:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "My Article Title",
      "articleBody": "Article content...",
      "image": {
        "@type": "ImageObject",
        "contentUrl": "https://example.com/image.jpg",
        "caption": "Image caption"
      }
    }
  ]
}
</script>
```

## Requirements

- WordPress 6.0+
- PHP 8.0+
- Node.js 18+ (for development)

## License

GPL-2.0-or-later

## Credits

Built with ❤️ by [Human Made](https://humanmade.com)
