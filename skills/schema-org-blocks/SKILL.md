---
name: schema-org-blocks
description: Add schema.org structured data to WordPress block markup, patterns and block theme templates with the Schema.org Blocks plugin. Use when asked to add, improve or check JSON-LD, rich results, FAQ, how-to, article, organization or blog listing markup in a site that has this plugin active, or when editing patterns or templates (single, home, archive, header) that should describe their content to search engines.
---

# Schema.org Blocks: annotating patterns and templates

The plugin turns a `schemaOrg` attribute on any block into JSON-LD in `wp_head` (or into Yoast SEO's graph). You add structured data by editing block markup: no PHP needed.

## The attribute

```json
"schemaOrg": {
  "type": "Article",
  "id": "organization",
  "isProperty": false,
  "propertyName": null,
  "mappings": { "url": { "source": "post", "field": "url" } }
}
```

- `type`: a schema.org type. A typed block that is not a property is an **entity** and becomes a node in the graph.
- `isProperty` + `propertyName`: the block is a value of its nearest typed ancestor. Add `type` too to make it a nested object (e.g. `Question` as `mainEntity`).
- `mappings`: property → source on the block itself. Sources: `attribute` (`attributeName`, also reads attributes stored in markup such as image `url`), `content` (the block's text, or a dynamic block's value), `innerBlocks` (text of inner blocks only), `post` (`field`: title, url, date, modified, excerpt, author, image), `site` (`field`: name, description, url, logo), `reference` (`id`: links to a site entity as `{"@id": …}`).
- `id`: names a site-wide entity. It is output as `@id` = home URL + `#id`. Use `organization` for the publisher and `website` for the site, the same ids Yoast SEO uses.

## How the graph is built

1. Every typed, non-property block is an entity.
2. Property blocks attach to the **nearest typed ancestor**, through untyped groups, columns, rows and template parts. They do not pass through another typed block, a property block, or an untyped post template.
3. A property block without a type gives its text, or the value of a dynamic block (post title, post date, author name, featured image, excerpt, terms, site title, tagline, logo). With a type, it becomes a nested object built the same way.
4. Several values for one property become an array. Plain text for an object-only property is wrapped, e.g. `acceptedAnswer` → `{"@type": "Answer", "text": …}` and `author` → `Person`.
5. A typed `core/post-template` gives one entity per post in its query, each with the post's `url`. As `itemListElement` of an `ItemList`, items become `ListItem`s with a `position`. As `blogPost` of a `Blog`, they stay `BlogPosting`s.
6. Hidden blocks, password-protected content, excerpts, and other posts' full content inside query loops are left out.

## Recipes

Working examples live in `patterns/` in the plugin and are registered as block patterns in the "Schema.org" category. Copy from them instead of writing markup from scratch.

| Goal | Pattern file | Root block |
|------|--------------|------------|
| FAQ | `faq.html` (accordion) or `faq-details.html` (details blocks) | `FAQPage` |
| How-to | `how-to.html` | `HowTo`, named from the post title |
| Single post template | `article-header.html` | `Article` with `publisher` → `organization` |
| Site header | `site-header-organization.html` | `Organization` with `id: organization` |
| Blog or archive listing | `blog-list.html` or `item-list.html` | `Blog` or `ItemList` on `core/query` |

To build a linked site graph in a block theme: put the organization pattern's group in the header template part, the article header in the single template, and a list pattern in home, index and archive templates.

## Editing rules

- **Keep markup valid.** The block editor checks saved HTML against what the block would save. Change only the JSON in block comment delimiters (`<!-- wp:group {"schemaOrg":…} -->`) and leave the HTML alone. If you need new blocks, copy them from a pattern file or build them in the editor and copy `wp.data.select('core/editor').getEditedPostContent()`.
- **Type the container, mark the leaves.** Put `type` on the outer group, query or accordion. Put `isProperty` + `propertyName` on the title, date, image or text blocks inside it. Don't type every block.
- **One entity per thing.** If an inner block should not be part of its typed ancestor, give it its own `type` (a separate entity), or leave it unannotated.
- **Use the editor's smart defaults where you can.** In the editor, "Quick setup" on groups (FAQ, How-to, Article, Organization), accordions (FAQ, How-to) and query blocks (Blog, Item list) sets up the inner blocks. "Apply suggested mappings to inner blocks" re-runs it after you add blocks.
- **Don't map private content.** Membership or paywall plugins that hide content through render filters do not hide it from the schema. Pattern overrides and block bindings are not applied either.

## Checking the result

1. Load a page that uses the markup and read the JSON-LD:
   ```bash
   curl -s https://example.com/sample-post/ | python3 -c "import sys,re,json; [print(json.dumps(json.loads(m),indent=1)) for m in re.findall(r'<script type=\"application/ld\+json\"[^>]*>(.*?)</script>', sys.stdin.read(), re.S)]"
   ```
   With Yoast SEO active, the nodes are in Yoast's `yoast-schema-graph` script instead. The command above reads that script too.
2. Check that each entity has its key properties: `headline` and `datePublished` for articles, `name` and `acceptedAnswer` for questions, `url` for list items, and that every `@id` reference has a matching node.
3. Validate with the Schema Markup Validator (validator.schema.org) or Google's Rich Results Test.

Google shows FAQ rich results only for some sites and no longer shows how-to rich results. The markup is still valid and other search and answer engines read it.
