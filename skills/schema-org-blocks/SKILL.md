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
- `mappings`: property → source on the block itself. Sources: `attribute` (`attributeName`, also reads attributes stored in markup such as image `url`), `content` (the block's text, or a dynamic block's value), `innerBlocks` (text of inner blocks only), `post` (`field`: title, url, date, modified, excerpt, author (a Person), image), `site` (`field`: name, description, url, logo, language), `reference` (`id`: links to any entity with that `id` as `{"@id": …}`).
- `id`: names a site-wide entity. It is output as `@id` = home URL + `#id`. Use `organization` for the publisher and `website` for the site, the same ids Yoast SEO uses.

The `schema-org-blocks/get-schema-types` ability lists the supported types and their properties, including inherited ones. Types added with the `schema_org_blocks_types` filter are included.

## How the graph is built

1. Every typed, non-property block is an entity.
2. Property blocks attach to the **nearest typed ancestor**, through untyped groups, columns, rows and template parts. They do not pass through another typed block, a property block, or an untyped post template.
3. A property block without a type gives its text, or the value of a dynamic block (post title, post date, author name, featured image, excerpt, terms, site title, tagline, logo). With a type, it becomes a nested object built the same way.
4. Several values for one property become an array. Plain text for an object-only property is wrapped, e.g. `acceptedAnswer` → `{"@type": "Answer", "text": …}` and `author` → `Person`.
5. A typed `core/post-template` gives one entity per post in its query, each with the post's `url`. As `itemListElement` of an `ItemList`, items become `ListItem`s with a `position`. As `blogPost` of a `Blog`, they stay `BlogPosting`s.
6. An entity inside another entity's blocks is nested under the outer one's `contains` property: `hasPart` by default for creative works, or set `"contains": "mainEntity"` (or `""` to turn it off). `core/post-content` counts as the post's blocks, so a typed group around post content in a template contains the post's FAQ or how-to.
7. References to `#website` or `#organization` that no block defines are filled from the site settings (not with Yoast active, which outputs them itself).
8. An entity nested more than once (e.g. one author on every post of a list) is output once with an `@id` and referenced elsewhere. Authors get Yoast's Person `@id`. Nothing is copied from outer entities to inner ones; link shared things with a `reference` mapping and map `inLanguage` from the `site` `language` field where wanted.
9. Hidden blocks, password-protected content, excerpts, and other posts' full content inside query loops are left out.
   A `core/breadcrumbs` block with no saved `schemaOrg` is a `BreadcrumbList` already: its rendered trail becomes the `itemListElement` `ListItem`s, its `@id` is the post permalink plus `#breadcrumb`, and the page node's `breadcrumb` points to it. Don't annotate it; to turn it off save `schemaOrg` with a null `type`.
10. Required properties are filled where nothing sets them. An `Article` (or subtype) with a post in context gets `headline`, `datePublished`, `dateModified` and `image` from the post, `publisher` as a reference to `#organization` (which is added from the site settings when no block defines it) and `author` as the post author's Person. A typed post template fills each post's own values. Other creative works left at the top level of a page are marked `isPartOf` the page.
11. Types have required properties, following Google's rich result requirements plus author and publisher for articles; schema.org itself has none. For example `Question` needs `name` and `acceptedAnswer`, `Offer` needs `price` and `priceCurrency`, and `Product` needs `name` and one of `offers`, `review` or `aggregateRating`. `get-schema-types` is not changed by this, but the editor's publish panel and the `issues` field below report what is not set.

## Recipes

Working examples are registered as block patterns in the "Schema.org" category, named `schema-org-blocks/<name>`. Their markup is in `patterns/<name>.html` in the plugin, and the `schema-org-blocks/get-guidance` ability returns it with this guide. Copy from them instead of writing markup from scratch.

| Goal | Pattern | Root block |
|------|---------|------------|
| FAQ | `faq` (accordion) or `faq-details` (details blocks) | `FAQPage` |
| How-to | `how-to` | `HowTo`, named from the post title |
| Single post template | `article-header` | `Article` with `publisher` → `organization` |
| Site header | `site-header-organization` | `Organization` with `id: organization` |
| Blog or archive listing | `blog-list` or `item-list` | `Blog` or `ItemList` on `core/query` |

To build a linked site graph in a block theme: put the organization pattern's group in the header template part, the article header in the single template, and a list pattern in home, index and archive templates.

To make the single template describe the whole page, type its main group with the "Web page" Quick setup (`WebPage`, `@id` and `url` from the post, `isPartOf` the site, `contains: mainEntity`) and wrap the post title and `core/post-content` in a group typed `Article`. The output is one page node with the Article and the entities in the post, plus WebSite and Organization nodes. A page type such as FAQPage in the post becomes the page node's type instead of nesting in it, and its questions become the page's `mainEntity`. Without a typed template the plugin adds the WebPage node itself.

## Editing rules

- **Keep markup valid.** The block editor checks saved HTML against what the block would save. Change only the JSON in block comment delimiters (`<!-- wp:group {"schemaOrg":…} -->`) and leave the HTML alone. If you need new blocks, copy them from a pattern or build them in the editor and copy `wp.data.select('core/editor').getEditedPostContent()`.
- **Save it where it lives.** Posts and pages store the markup in their content. Templates, template parts and synced patterns are stored as posts too, or as files in a block theme. Update them with whatever your tools allow: the editor, the REST API, the theme files, or an ability that updates content.
- **Type the container, mark the leaves.** Put `type` on the outer group, query or accordion. Put `isProperty` + `propertyName` on the title, date, image or text blocks inside it. Don't type every block.
- **One entity per thing.** If an inner block should not be part of its typed ancestor, give it its own `type` (a separate entity), or leave it unannotated.
- **Use the editor's smart defaults where you can.** In the editor, "Quick setup" on groups (FAQ, How-to, Article, Organization), accordions (FAQ, How-to) and query blocks (Blog, Item list) sets up the inner blocks. "Apply suggested mappings to inner blocks" re-runs it after you add blocks.
- **Don't map private content.** Membership or paywall plugins that hide content through render filters do not hide it from the schema. Pattern overrides and block bindings are not applied either.

## Checking the result

1. Run the `schema-org-blocks/get-schema-graph` ability. With the `url` or `post_id` of a published page, it returns the JSON-LD that page outputs, including Yoast SEO's graph. With a draft's `post_id`, or block markup as `content`, it builds the graph from those blocks only, so entities from the template, such as the site Organization, are missing. Add `with_template: true` to `content` and `post_id` in a block theme to build from the post's block template instead, with `content` standing in for the post's content. This is what the editor's pre-publish check does.

   Without the abilities, load the page and read the JSON-LD:
   ```bash
   curl -s https://example.com/sample-post/ | python3 -c "import sys,re,json; [print(json.dumps(json.loads(m),indent=1)) for m in re.findall(r'<script type=\"application/ld\+json\"[^>]*>(.*?)</script>', sys.stdin.read(), re.S)]"
   ```
   With Yoast SEO active, the nodes are in Yoast's `yoast-schema-graph` script instead. The command above reads that script too.
2. Read the `issues` list of the result. It comes from the [humanmade/schema-org-validator](https://github.com/humanmade/schema-org-validator) library, which checks the graph against the schema.org vocabulary, this plugin's required properties and Google's rich result requirements. Each issue has a `severity` (`error` or `warning`), a `code`, a `message`, the `type` and `property` it is about, a `label` for the node, a JSON pointer `path` and the `source` that raised it (`schema.org`, `schema-org-blocks/required` or a Google profile such as `google/article`). Errors, such as `missing_required` for a Question with no accepted answer, must be fixed. Warnings such as `invalid_value` or `unknown_property` point at likely mistakes. A warning with the code `missing_recommended` is a suggestion that Google would like the property too; add it when the content has it. An empty list means nothing was found. Fix the blocks and run the ability again. Also check that every `@id` reference has a matching node.
3. Validate with the Schema Markup Validator (validator.schema.org) or Google's Rich Results Test.

Google shows FAQ rich results only for some sites and no longer shows how-to rich results. The markup is still valid and other search and answer engines read it.
