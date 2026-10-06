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
			$bound_field = $block['attrs']['metadata']['bindings']['datetime']['args']['field'] ?? '';
			$is_modified = 'modified' === $bound_field || 'modified' === ( $block['attrs']['displayType'] ?? '' );
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
 * Get the object a dynamic block stands for, when it is richer than its text.
 *
 * Author blocks give the post author as a Person.
 *
 * @param array<string, mixed> $block   Parsed block.
 * @param array<string, mixed> $context Block context.
 * @return array<string, mixed>|null
 */
function get_object( array $block, array $context ) : ?array {
	if ( ! in_array( $block['blockName'] ?? '', [ 'core/post-author', 'core/post-author-name' ], true ) ) {
		return null;
	}

	$post = get_post( get_post_id( $context ) );
	return $post instanceof WP_Post ? get_author_person( $post ) : null;
}

/**
 * Get a post's author as a Person, with the @id Yoast SEO uses for the same user.
 *
 * @param WP_Post $post Post.
 * @return array<string, mixed>|null
 */
function get_author_person( WP_Post $post ) : ?array {
	$user = get_userdata( (int) $post->post_author );

	if ( ! $user ) {
		return null;
	}

	return [
		'@type' => 'Person',
		'@id'   => home_url( '/' ) . '#/schema/person/' . wp_hash( $user->user_login . $user->ID ),
		'name'  => text( $user->display_name ),
		'url'   => get_author_posts_url( $user->ID ),
	];
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
			return non_empty( get_permalink( $post ) );
		case 'date':
			return non_empty( get_post_time( 'c', false, $post ) );
		case 'modified':
			return non_empty( get_post_modified_time( 'c', false, $post ) );
		case 'excerpt':
			return post_password_required( $post ) ? null : text( get_the_excerpt( $post ) );
		case 'author':
			return text( get_the_author_meta( 'display_name', (int) $post->post_author ) );
		case 'image':
			return non_empty( get_the_post_thumbnail_url( $post, 'full' ) );
	}

	return null;
}

/**
 * Get a field of the site.
 *
 * @param string $field `name`, `description`, `url`, `logo` (custom logo URL) or `language` (BCP 47 code).
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
		case 'language':
			return non_empty( get_bloginfo( 'language' ) );
		case 'logo':
			$logo_id = (int) get_theme_mod( 'custom_logo', get_option( 'site_logo' ) );
			return $logo_id ? non_empty( wp_get_attachment_image_url( $logo_id, 'full' ) ) : null;
	}

	return null;
}

/**
 * Get a value as a string, or null when it is empty or false.
 *
 * @param string|false|null $value Value.
 * @return string|null
 */
function non_empty( $value ) : ?string {
	return $value ? (string) $value : null;
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
