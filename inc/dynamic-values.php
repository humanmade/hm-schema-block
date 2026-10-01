<?php
/**
 * Values of dynamic blocks, such as post title or site logo, whose saved markup is empty.
 *
 * @package SchemaOrgBlocks
 */

namespace SchemaOrgBlocks\DynamicValues;

use SchemaOrgBlocks\BlockValues;
use WP_Post;

/**
 * Get the value a dynamic block shows, for the post in the block context.
 *
 * @param array<string, mixed> $block   Parsed block.
 * @param array<string, mixed> $context Block context, e.g. `postId`.
 * @return string|null The value, or null when the block has no dynamic value.
 */
function get_value( array $block, array $context ) : ?string {
	$name = $block['blockName'] ?? '';

	switch ( $name ) {
		case 'core/site-title':
			return text( get_bloginfo( 'name' ) );
		case 'core/site-tagline':
			return text( get_bloginfo( 'description' ) );
		case 'core/site-logo':
			return get_site_field( 'logo' );
	}

	if ( ! str_starts_with( $name, 'core/post-' ) ) {
		return null;
	}

	$post = get_post( get_post_id( $context ) );
	if ( ! $post instanceof WP_Post ) {
		return null;
	}

	switch ( $name ) {
		case 'core/post-title':
			return get_post_field( 'title', $post );
		case 'core/post-date':
			$is_modified = 'modified' === ( $block['attrs']['displayType'] ?? '' );
			return get_post_field( $is_modified ? 'modified' : 'date', $post );
		case 'core/post-author':
		case 'core/post-author-name':
			return get_post_field( 'author', $post );
		case 'core/post-featured-image':
			return get_post_field( 'image', $post );
		case 'core/post-excerpt':
			return get_post_field( 'excerpt', $post );
		case 'core/post-terms':
			$terms = get_the_terms( $post, (string) ( $block['attrs']['term'] ?? 'category' ) );
			return is_array( $terms ) && $terms ? text( implode( ', ', wp_list_pluck( $terms, 'name' ) ) ) : null;
	}

	return null;
}

/**
 * Get the post ID from block context, falling back to the current post.
 *
 * @param array<string, mixed> $context Block context.
 * @return int Post ID, or 0.
 */
function get_post_id( array $context ) : int {
	return (int) ( $context['postId'] ?? get_the_ID() );
}

/**
 * Get a field of a post.
 *
 * @param string  $field `title`, `url`, `date` (ISO 8601), `modified`, `excerpt`, `author` (display name) or `image` (featured image URL).
 * @param WP_Post $post  Post.
 * @return string|null
 */
function get_post_field( string $field, WP_Post $post ) : ?string {
	switch ( $field ) {
		case 'title':
			return text( get_the_title( $post ) );
		case 'url':
			return get_permalink( $post ) ?: null;
		case 'date':
			return get_post_time( 'c', false, $post ) ?: null;
		case 'modified':
			return get_post_modified_time( 'c', false, $post ) ?: null;
		case 'excerpt':
			return post_password_required( $post ) ? null : text( get_the_excerpt( $post ) );
		case 'author':
			return text( get_the_author_meta( 'display_name', (int) $post->post_author ) );
		case 'image':
			return get_the_post_thumbnail_url( $post, 'full' ) ?: null;
	}

	return null;
}

/**
 * Get a field of the site.
 *
 * @param string $field `name`, `description`, `url` or `logo` (custom logo URL).
 * @return string|null
 */
function get_site_field( string $field ) : ?string {
	switch ( $field ) {
		case 'name':
			return text( get_bloginfo( 'name' ) );
		case 'description':
			return text( get_bloginfo( 'description' ) );
		case 'url':
			return home_url( '/' );
		case 'logo':
			$logo_id = (int) get_theme_mod( 'custom_logo', get_option( 'site_logo' ) );
			return $logo_id ? ( wp_get_attachment_image_url( $logo_id, 'full' ) ?: null ) : null;
	}

	return null;
}

/**
 * Turn a string that may hold markup or entities into plain text, or null when empty.
 *
 * @param string $value Value.
 * @return string|null
 */
function text( string $value ) : ?string {
	$text = BlockValues\get_text( $value );
	return '' === $text ? null : $text;
}
