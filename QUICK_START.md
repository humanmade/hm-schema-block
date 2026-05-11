# Quick Start Guide

Get up and running with Schema.org Blocks in 5 minutes.

## Installation

```bash
# Install dependencies
npm install
composer install

# Build the plugin
npm run build

# Start local development environment (optional)
npm run env:start
```

## Basic Usage

### 1. Create an Article with Schema

1. Create a new post in WordPress
2. Add a **Group** block (or any container block)
3. In the block inspector sidebar, open **"Schema.org Mapping"**
4. Select **"Article"** as the Schema Type
5. Add attribute mappings:
   - Map `headline` → Block Content
   - Map `articleBody` → Block Content

### 2. Add an Image with Auto-Mapping

1. Inside the Group block, add an **Image** block
2. Upload or select an image
3. Open the **"Schema.org Mapping"** panel
4. Notice it's automatically configured:
   - ✅ "Map as property of parent" is checked
   - ✅ Property name is set to "image"
   - ✅ Type is set to "ImageObject"
   - ✅ Mappings are pre-configured

### 3. View the Schema Output

**View Page Source:**
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
        "caption": "Image caption",
        "width": 1200,
        "height": 800
      }
    }
  ]
}
</script>
```

## Common Patterns

### Pattern 1: Place with Nested Address

```
Group (Place)
├── Heading (→ name)
├── Paragraph (→ description)
└── Group (PostalAddress as "address" property)
    ├── Paragraph (→ streetAddress)
    ├── Paragraph (→ addressLocality)
    └── Paragraph (→ postalCode)
```

### Pattern 2: Product Listing

```
Group (Product)
├── Heading (→ name)
├── Image (→ image as ImageObject)
├── Paragraph (→ description)
└── Group (Offer as "offers" property)
    ├── Paragraph (→ price)
    └── Paragraph (→ priceCurrency)
```

### Pattern 3: Organization

```
Group (Organization)
├── Heading (→ name)
├── Image (→ logo as ImageObject)
├── Paragraph (→ description)
└── Button (→ url)
```

## Smart Defaults

These blocks automatically configure when nested in a schema context:

| Block | Auto-maps to | As type |
|-------|--------------|---------|
| **Image** | `image` property | ImageObject |
| **Button** | `url` property | URL |
| **Heading** | `headline` or `name` | Text |
| **Paragraph** | `description` or `text` | Text |

## Hierarchical Types

Some schema types have subtypes. The plugin automatically filters available types based on parent context:

**Example: Place → Accommodation → Room**

1. Group block → Select "Place"
2. Add nested Group → Options include "Accommodation"
3. Add another nested Group → Options include "Room"

This ensures valid schema hierarchies.

## Property Types

Some properties accept multiple types. Example: `image` can be:

- **URL** (string): Map directly to image URL attribute
- **ImageObject** (object): Create nested schema with properties

The smart defaults handle this automatically for images.

## Testing Your Schema

Use these tools to validate:

- **Google Rich Results Test**: https://search.google.com/test/rich-results
- **Schema.org Validator**: https://validator.schema.org/
- **Yoast SEO Schema**: If Yoast is installed, schema appears in their graph

## Development

Start development environment:
```bash
npm run env:start  # Start wp-env
npm start         # Watch and rebuild on changes
```

Visit: http://localhost:8889

Run tests:
```bash
npm run test:e2e
```

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines
- Explore `inc/schema-types.php` to see all available schema types
- Review `src/utils/smart-defaults.js` to understand auto-mapping logic

## Need Help?

- Open an issue on GitHub
- Check WordPress.org support forums
- Review the Schema.org documentation: https://schema.org/

Happy schema mapping! 🎉
