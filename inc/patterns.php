<?php
/**
 * Example block patterns set up with schema.org mappings.
 *
 * @package SchemaOrgBlocks
 */

namespace SchemaOrgBlocks\Patterns;

/**
 * Pattern category slug.
 */
const CATEGORY = 'schema-org-blocks';

/**
 * Register hooks.
 */
function bootstrap() : void {
	add_action( 'init', __NAMESPACE__ . '\\register_patterns' );
}

/**
 * Get the patterns, keyed by file name in patterns/ without the extension.
 *
 * @return array<string, array<string, mixed>> Pattern properties, without content.
 */
function get_patterns() : array {
	return [
		'faq'                      => [
			'title'       => __( 'FAQ accordion', 'schema-org-blocks' ),
			'description' => __( 'Questions and answers in an accordion, output as FAQPage.', 'schema-org-blocks' ),
			'keywords'    => [ 'faq', 'questions', 'accordion' ],
		],
		'how-to'                   => [
			'title'       => __( 'How-to accordion', 'schema-org-blocks' ),
			'description' => __( 'Steps in an accordion, output as HowTo named after the post.', 'schema-org-blocks' ),
			'keywords'    => [ 'how-to', 'steps', 'accordion' ],
		],
		'faq-details'              => [
			'title'       => __( 'FAQ details', 'schema-org-blocks' ),
			'description' => __( 'Questions and answers in details blocks, output as FAQPage.', 'schema-org-blocks' ),
			'keywords'    => [ 'faq', 'questions', 'details' ],
		],
		'article-header'           => [
			'title'         => __( 'Article header', 'schema-org-blocks' ),
			'description'   => __( 'Post title, date, author, categories and featured image, output as an Article published by the site Organization.', 'schema-org-blocks' ),
			'keywords'      => [ 'article', 'post', 'header' ],
			'templateTypes' => [ 'single' ],
		],
		'site-header-organization' => [
			'title'       => __( 'Site header with Organization', 'schema-org-blocks' ),
			'description' => __( 'Site logo, title and tagline, output as the site Organization.', 'schema-org-blocks' ),
			'keywords'    => [ 'organization', 'header', 'logo' ],
			'blockTypes'  => [ 'core/template-part/header' ],
		],
		'blog-list'                => [
			'title'       => __( 'Blog post list', 'schema-org-blocks' ),
			'description' => __( 'Latest posts, output as a Blog with a BlogPosting for each post.', 'schema-org-blocks' ),
			'keywords'    => [ 'blog', 'posts', 'query' ],
			'blockTypes'  => [ 'core/query' ],
		],
		'item-list'                => [
			'title'       => __( 'Post item list', 'schema-org-blocks' ),
			'description' => __( 'Latest posts, output as an ItemList with a ListItem for each post.', 'schema-org-blocks' ),
			'keywords'    => [ 'list', 'posts', 'query' ],
			'blockTypes'  => [ 'core/query' ],
		],
	];
}

/**
 * Get the block markup of a pattern.
 *
 * @param string $slug Pattern file name in patterns/ without the extension.
 * @return string|null Markup, or null when the file is not readable.
 */
function get_pattern_content( string $slug ) : ?string {
	$file = SCHEMA_ORG_BLOCKS_PATH . '/patterns/' . $slug . '.html';

	if ( ! is_readable( $file ) ) {
		return null;
	}

	return (string) file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file.
}

/**
 * Register the pattern category and the patterns.
 */
function register_patterns() : void {
	$category = [
		'label'       => __( 'Schema.org', 'schema-org-blocks' ),
		'description' => __( 'Blocks set up to output schema.org structured data.', 'schema-org-blocks' ),
	];
	register_block_pattern_category( CATEGORY, $category );

	foreach ( get_patterns() as $slug => $pattern ) {
		$content = get_pattern_content( $slug );

		if ( null === $content ) {
			continue;
		}

		$pattern['categories'] = [ CATEGORY ];
		$pattern['content']    = $content;

		register_block_pattern( 'schema-org-blocks/' . $slug, $pattern );
	}
}
