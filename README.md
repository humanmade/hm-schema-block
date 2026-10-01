# Schema.org Blocks

A WordPress plugin that extends all blocks with schema.org type mapping and structured data output.

<a href="https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/humanmade/hm-schema-block/main/playground-blueprint.json"><img src="https://raw.githubusercontent.com/adamziel/playground-preview/refs/heads/trunk/assets/playground-preview-button.svg" width="224" height="52" alt="Open in WordPress Playground"></a>

## Features

- 🎯 **Universal Block Extension**: Adds schema.org mapping to all WordPress blocks
- 🔗 **Block Context Support**: Blocks can provide and consume schema types from parent/child relationships
- ❓ **FAQ and How-to Presets**: FAQ and How-to variations of the Accordion block, plus Quick setup buttons on Accordion and Group blocks
- 🎨 **Smart Defaults**: Automatic mapping for common blocks (image, button, heading, paragraph, accordion, details)
- 🌳 **Hierarchical Types**: Support for nested schema types (e.g., Place > Accommodation > Room)
- 🔄 **Flexible Property Mapping**: Map block attributes, block text, inner blocks text or post fields to schema properties
- 🚀 **Yoast SEO Integration**: Extends Yoast's schema output when available
- 📊 **JSON-LD Fallback**: Automatic JSON-LD output when Yoast is not installed

## Installation

1. Clone this repository to your WordPress plugins directory:
```bash
cd wp-content/plugins
git clone https://github.com/humanmade/hm-schema-block.git
cd hm-schema-block
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

### Local Development with WordPress Playground

Start the development environment:
```bash
npm run playground:start
```

Start the build watcher:
```bash
npm start
```

Access your development site at http://127.0.0.1:9400. You are logged in as `admin` (password `password`) and the plugin is already active.

### Testing

Run Playwright e2e tests:
```bash
npm run test:e2e
```

The tests start their own Playground instance on a port between 9400 and 9499, based on the checkout path, so worktrees can run in parallel. Set `WP_PLAYGROUND_PORT` to pick the port, or `WP_BASE_URL` to use a server you already started.

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
npm run format
```

## Usage

### Basic Schema Type Mapping

1. Edit any post or page in the block editor
2. Select a block (e.g., a Group block)
3. In the block inspector, open the "Schema.org Mapping" panel
4. Select a schema type (e.g., "Article", "Organization", "Place")
5. Add mappings from schema properties to a source

Each mapping has a source:

- **Block attribute**: a block attribute. This includes attributes that core blocks store in their markup, such as the image `url` or the details `summary`. With no attribute picked, the block text is used.
- **Block text**: the text of the block, including its inner blocks.
- **Inner blocks text**: the text of the inner blocks only. A details block uses this for its answer, without the summary.
- **Post title** and **Post URL**: fields of the current post.

### FAQ and How-to

Insert the **FAQ** or **How-to** variation of the Accordion block. Both come set up: each accordion item is a Question or a HowToStep, the heading is its name, and the panel is the answer or the step text. The How-to takes its name from the post title.

You can also set up existing blocks. Select an Accordion or Group block and use the **FAQ** or **How-to** button under Quick setup. Details blocks inside an FAQ become Questions: the summary is the question and the inner blocks are the answer. Any typed block with inner blocks has an **Apply suggested mappings to inner blocks** link, which applies the smart defaults again.

Google shows FAQ rich results only for some sites and no longer shows how-to rich results, but the markup is still valid and other search and answer engines use it.

### Parent and Child Blocks

When a parent block has a schema type, a direct child block can:

1. **Map as a property**: turn on "Map as property of parent" and pick the property. The block's text becomes the value.
2. **Pick a value type**: a property block can also pick a type from those the property accepts. It is then output as a nested object, with its own mappings and child properties.
3. **Be its own entity**: leave the toggle off and pick any schema type. The block is output as a separate object.

Only direct children of a typed block can be its properties. The child values follow these rules:

- Several children mapped to the same property produce an array, such as the questions of an FAQPage.
- A plain value for a property that only accepts objects is wrapped. For example `acceptedAnswer` text becomes an `Answer` with `text`, and an `author` name becomes a `Person` with `name`.
- An object with no properties is left out of the output.
- A child value replaces a mapping on the parent for the same property.

### Smart Defaults

When you add a block inside a typed parent, it is set up for you:

- **core/heading**: `headline` or `name`
- **core/paragraph**: `description` or `text`
- **core/image**: `image` or `logo`, as an `ImageObject` with `contentUrl` and `caption` when the property accepts one. Several images give an array.
- **core/button**: `url`, from the button link
- **core/accordion-item**: a `Question` for `mainEntity`, or a `HowToStep` for `step`
- **core/accordion-heading**: `name`, from the heading title
- **core/accordion-panel**: `acceptedAnswer` or `text`
- **core/details**: a `Question` or `HowToStep`, with the summary as `name` and the inner blocks as the answer or text

The first property the parent type has is used. Headings and paragraphs inside a Question, Answer or HowToStep get no default, since their text already feeds the answer. Most blocks get a default only for the first unconfigured block of that type, and only while no sibling claims the property. Images, accordion items and details blocks repeat. If you turn off "Map as property of parent", the block keeps that choice.

### Example: Article with Schema

```
Group (Article)
├── Heading (→ headline property)
├── Paragraph (→ description property)
├── Image (→ image property as ImageObject)
│   ├── URL → contentUrl
│   └── Caption → caption
└── Button (→ url property)
```

### Example: FAQ

```
Accordion (FAQPage)
├── Accordion item (→ mainEntity as Question)
│   ├── Accordion heading (→ name)
│   └── Accordion panel (→ acceptedAnswer)
└── Accordion item (→ mainEntity as Question)
    ├── Accordion heading (→ name)
    └── Accordion panel (→ acceptedAnswer)
```

## Schema Types

The plugin includes comprehensive schema.org type definitions including:

- **Creative Works**: Article, BlogPosting, NewsArticle, CreativeWork, WebPage, Comment
- **FAQs and How-tos**: FAQPage, Question, Answer, HowTo, HowToStep
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

Smart defaults are a rule table (`RULES`) in `src/utils/smart-defaults.js`, keyed by block name. Each rule lists candidate parent `properties` in order of preference. It can also set `repeatable`, `exceptParentTypes`, and a `build` function that returns the `schemaOrg` value. Add a rule to support another block type.

### Changing the Output

Use the `schema_org_blocks_graph` filter to change the final list of schema objects:

```php
add_filter( 'schema_org_blocks_graph', function( $graph ) {
    $graph[] = [
        '@type' => 'Organization',
        'name'  => 'Example Ltd',
        'url'   => 'https://example.com',
    ];
    return $graph;
} );
```

## Output

Schema is collected from the blocks of the current page. Block themes render their templates before `wp_head`, so the plugin collects each typed block as it renders. Classic themes render content after `wp_head`, so on single posts and pages the plugin reads the queried post's blocks instead.

### With Yoast SEO

When Yoast SEO is active, the schema objects are added to Yoast's graph using the `wpseo_schema_graph` filter.

### Without Yoast SEO

Schema data is output as JSON-LD in the site header. The characters `<`, `>` and `&` are hex-escaped, so a mapped value cannot close the script tag.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "My Article Title",
      "description": "Article summary...",
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

- WordPress 6.9+
- PHP 8.0+
- Node.js 18+ (for development)

## License

GPL-2.0-or-later

## Credits

Built with ❤️ by [Human Made](https://humanmade.com)
