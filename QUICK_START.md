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
npm run playground:start
```

## Basic Usage

### FAQ and How-to

1. Create a new post and open the block inserter
2. Search for **FAQ** or **How-to** and insert it. Both are variations of the Accordion block.
3. Fill in the headings and panels. Each item becomes a Question with an answer, or a HowToStep. The How-to is named after the post title.

Already have an Accordion or Group block? Select it, open **"Schema.org Mapping"** and click **FAQ** or **How-to** under Quick setup. Details blocks inside an FAQ become questions too: the summary is the question and the inner blocks are the answer.

Google shows FAQ rich results only for some sites and no longer shows how-to rich results. The markup is still valid and other consumers use it.

### 1. Create an Article with Schema

1. Create a new post in WordPress
2. Add a **Group** block (or any container block)
3. In the block inspector sidebar, open **"Schema.org Mapping"**
4. Select **"Article"** as the Schema Type
5. Add a **Heading** and a **Paragraph** inside the Group. They map to `headline` and `description` on their own.

You can also add mappings on the Group itself. Each mapping has a source: a block attribute, the block text, the inner blocks text, a post field (title, URL, dates, excerpt, author, featured image), a site field (name, tagline, URL, logo), or a link to the site Organization. For example, map `headline` to Post title.

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

## Block Themes

The plugin adds a **Schema.org** pattern category. Three of its patterns build a linked site graph:

1. Open **Appearance → Editor** and edit the **Header** template part. Insert **Site header with Organization**, or select an existing Group with the site logo and title and click **Organization** under Quick setup.
2. Edit the **Single Posts** template. Insert **Article header** in place of the post title, date and featured image. Its `publisher` links to the header's Organization.
3. Edit the **Blog Home**, **Index** or **Archive** template. Insert **Blog post list** or **Post item list**, or select the Query Loop and click **Blog** or **Item list** under Quick setup.

To check the output, open a post on the front end and view the page source. Look for the `application/ld+json` script, or Yoast's `yoast-schema-graph` script when Yoast SEO is active. You should see:

- an `Organization` with `"@id": "https://example.com/#organization"`
- an `Article` with `headline`, `datePublished`, `author` and `"publisher": { "@id": "https://example.com/#organization" }`
- on the home page, a `Blog` with a `blogPost` entry per post, or an `ItemList` with a `ListItem` per post

Paste the URL into the validators under [Testing Your Schema](#testing-your-schema) to check it.

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
| **Image** | `image` or `logo` | ImageObject |
| **Button** | `url` property | URL |
| **Heading** | `headline` or `name` | Text |
| **Paragraph** | `description` or `text` | Text |
| **Accordion item** | `mainEntity` or `step` | Question or HowToStep |
| **Accordion heading** | `name` | Text |
| **Accordion panel** | `acceptedAnswer` or `text` | Answer or Text |
| **Details** | `mainEntity` or `step` | Question or HowToStep |
| **Post Title, Date, Author, Featured Image, Excerpt, Terms** | `headline`, `datePublished` or `dateModified`, `author`, `image`, `description`, `keywords` | Text, Person or URL |
| **Site Title, Tagline, Logo** | `name`, `description`, `logo` | Text or URL |
| **Post Template** | `blogPost` or `itemListElement` | BlogPosting |

Only the first unconfigured block of each type gets a default, except images, accordion items and details blocks, which repeat. Headings and paragraphs inside a Question, Answer or HowToStep are left alone. To re-apply the defaults, select the typed block and click **Apply suggested mappings to inner blocks**.

## Hierarchical Types

Some schema types have subtypes, and inherit their parent type's properties. **Example: Place → Accommodation → Room**

When a block is mapped as a property of its parent, its **Value Type** list only shows the types that property accepts, plus their subtypes. A property block belongs to its nearest typed ancestor, even through untyped groups and columns in between.

## Property Types

Some properties accept multiple types. Example: `image` can be:

- **URL** (string): Map directly to image URL attribute
- **ImageObject** (object): Create nested schema with properties

The smart defaults handle this automatically for images.

Several blocks mapped to the same property give an array. Plain text for a property that only accepts objects is wrapped, so an `acceptedAnswer` becomes an `Answer` with `text`. Objects with no properties are left out.

## Testing Your Schema

Use these tools to validate:

- **Google Rich Results Test**: https://search.google.com/test/rich-results
- **Schema.org Validator**: https://validator.schema.org/
- **Yoast SEO Schema**: If Yoast is installed, schema appears in their graph

## Development

Start development environment:
```bash
npm run playground:start  # Start WordPress Playground
npm start                 # Watch and rebuild on changes
```

Visit: http://127.0.0.1:9400

Run tests (they boot their own Playground on a port between 9400 and 9499; set `WP_PLAYGROUND_PORT` to change it or `WP_BASE_URL` to reuse a running server):
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
