<?php
/**
 * Read values out of parsed blocks: attributes, including those sourced from saved markup, and text content.
 *
 * @package SchemaOrgBlocks
 */

namespace SchemaOrgBlocks\BlockValues;

use WP_Block_Type_Registry;
use WP_HTML_Processor;

/**
 * Tags that do not separate words when their text is joined.
 */
const INLINE_TAGS = [ 'A', 'ABBR', 'B', 'BDI', 'BDO', 'CITE', 'CODE', 'DATA', 'DFN', 'EM', 'I', 'KBD', 'MARK', 'Q', 'S', 'SAMP', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TIME', 'U', 'VAR' ];

/**
 * Get a block attribute value.
 *
 * Attributes stored in the block comment delimiter are returned as is. Attributes that the
 * block type sources from its saved markup, such as core/image `url` or core/details
 * `summary`, are read from the block's HTML. Markup is stripped from string values.
 *
 * @param array<string, mixed> $block Parsed block.
 * @param string               $name  Attribute name.
 * @return string|int|float|bool|null
 */
function get_attribute( array $block, string $name ) {
	if ( array_key_exists( $name, $block['attrs'] ?? [] ) ) {
		$value = $block['attrs'][ $name ];
	} else {
		$type       = WP_Block_Type_Registry::get_instance()->get_registered( $block['blockName'] ?? '' );
		$definition = $type?->attributes[ $name ] ?? null;

		if ( ! is_array( $definition ) ) {
			return null;
		}

		$value = isset( $definition['source'] ) ? get_sourced_value( $block['innerHTML'] ?? '', $definition ) : null;
		$value ??= $definition['default'] ?? null;
	}

	if ( is_string( $value ) ) {
		return str_contains( $value, '<' ) ? get_text( $value ) : html_entity_decode( $value, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
	}

	return is_scalar( $value ) ? $value : null;
}

/**
 * Read an attribute value from markup using its block.json source definition.
 *
 * Supports the `attribute`, `html`, `rich-text` and `text` sources. Selectors are matched on
 * their last compound part (tag name and classes), plus a parent tag for `parent > child`.
 * Selectors using attribute or pseudo-class syntax are not supported and give null.
 *
 * @param string               $html       Block markup.
 * @param array<string, mixed> $definition Attribute definition.
 * @return string|null
 */
function get_sourced_value( string $html, array $definition ) : ?string {
	$source   = $definition['source'];
	$selector = $definition['selector'] ?? '';

	if ( ! in_array( $source, [ 'attribute', 'html', 'rich-text', 'text' ], true ) ) {
		return null;
	}

	if ( 'attribute' !== $source && '' === $selector ) {
		return get_text( $html );
	}

	if ( preg_match( '/[\[:]/', $selector ) ) {
		return null;
	}

	$processor = WP_HTML_Processor::create_fragment( $html );
	if ( ! $processor ) {
		return null;
	}

	while ( $processor->next_tag() ) {
		if ( '' !== $selector && ! matches_selector( $processor, $selector ) ) {
			continue;
		}

		if ( 'attribute' === $source ) {
			$value = $processor->get_attribute( $definition['attribute'] ?? '' );
			return is_string( $value ) ? $value : null;
		}

		$text = read_text( $processor, $processor->get_current_depth() );

		return null === $processor->get_last_error() ? $text : null;
	}

	return null;
}

/**
 * Check whether the element at the processor's position matches a selector list.
 *
 * Only the last compound selector of each list item is checked (tag name and classes), and
 * for a `parent > child` item, the parent's tag name.
 *
 * @param WP_HTML_Processor $processor HTML processor positioned on a tag.
 * @param string            $selector  CSS selector list, e.g. "h1,h2" or "figure img".
 * @return bool
 */
function matches_selector( WP_HTML_Processor $processor, string $selector ) : bool {
	foreach ( explode( ',', $selector ) as $item ) {
		$parts    = preg_split( '/\s*([\s>+~])\s*/', trim( $item ), -1, PREG_SPLIT_DELIM_CAPTURE );
		$compound = (string) array_pop( $parts );
		$combinator = (string) array_pop( $parts );
		$parent     = (string) array_pop( $parts );

		if ( '>' === $combinator && preg_match( '/^[a-z][a-z0-9-]*$/i', $parent ) ) {
			$breadcrumbs = $processor->get_breadcrumbs();
			if ( strtoupper( $parent ) !== ( $breadcrumbs[ count( $breadcrumbs ) - 2 ] ?? '' ) ) {
				continue;
			}
		}

		if ( ! preg_match( '/^([a-z][a-z0-9-]*)?((?:\.[\w-]+)*)/i', $compound, $match ) || '' === $match[0] ) {
			continue;
		}

		if ( '' !== $match[1] && strtoupper( $match[1] ) !== $processor->get_tag() ) {
			continue;
		}

		$classes = array_filter( explode( '.', $match[2] ) );
		foreach ( $classes as $class ) {
			if ( ! $processor->has_class( $class ) ) {
				continue 2;
			}
		}

		return true;
	}

	return false;
}

/**
 * Get the readable text of an HTML string.
 *
 * Text inside `aria-hidden="true"` elements is skipped, as are scripts and styles.
 * Whitespace is collapsed.
 *
 * @param string $html HTML.
 * @return string
 */
function get_text( string $html ) : string {
	$processor = WP_HTML_Processor::create_fragment( $html );
	if ( ! $processor ) {
		return normalize_whitespace( wp_strip_all_tags( $html ) );
	}

	$text = read_text( $processor, 0 );

	if ( null !== $processor->get_last_error() ) {
		return normalize_whitespace( wp_strip_all_tags( $html ) );
	}

	return $text;
}

/**
 * Read text from the processor's position until the stack depth drops below a limit.
 *
 * @param WP_HTML_Processor $processor HTML processor.
 * @param int               $min_depth Stop at the first token shallower than this. 0 reads to the end.
 * @return string
 */
function read_text( WP_HTML_Processor $processor, int $min_depth ) : string {
	$text         = '';
	$hidden_depth = null;

	while ( $processor->next_token() ) {
		$depth = $processor->get_current_depth();

		if ( $depth < $min_depth ) {
			break;
		}

		if ( null !== $hidden_depth && $depth < $hidden_depth ) {
			$hidden_depth = null;
		}

		$token = $processor->get_token_type();

		if ( '#text' === $token ) {
			if ( null === $hidden_depth ) {
				$text .= $processor->get_modifiable_text();
			}
			continue;
		}

		if ( '#tag' !== $token ) {
			continue;
		}

		if ( null === $hidden_depth && ! $processor->is_tag_closer() && $processor->expects_closer() && 'true' === $processor->get_attribute( 'aria-hidden' ) ) {
			$hidden_depth = $depth;
		}

		if ( ! in_array( $processor->get_tag(), INLINE_TAGS, true ) ) {
			$text .= ' ';
		}
	}

	return normalize_whitespace( $text );
}

/**
 * Collapse runs of whitespace to single spaces and trim.
 *
 * @param string $text Text.
 * @return string
 */
function normalize_whitespace( string $text ) : string {
	return trim( (string) preg_replace( '/\s+/u', ' ', $text ) );
}

/**
 * Get a block's saved markup including the markup of its inner blocks.
 *
 * Synced patterns (core/block) and post content (core/post-content, for the current post) are
 * replaced by the markup of their blocks.
 *
 * @param array<string, mixed> $block Parsed block.
 * @return string
 */
function get_html( array $block ) : string {
	if ( in_array( $block['blockName'] ?? '', [ 'core/block', 'core/post-content' ], true ) ) {
		return implode( "\n", array_map( __NAMESPACE__ . '\\get_html', get_inner_blocks( $block ) ) );
	}

	$html  = '';
	$index = 0;

	foreach ( $block['innerContent'] ?? [ $block['innerHTML'] ?? '' ] as $chunk ) {
		if ( is_string( $chunk ) ) {
			$html .= $chunk;
		} elseif ( isset( $block['innerBlocks'][ $index ] ) ) {
			$html .= get_html( $block['innerBlocks'][ $index++ ] );
		}
	}

	return $html;
}

/**
 * Get a block's inner blocks, resolving synced patterns, template parts and post content to their blocks.
 *
 * @param array<string, mixed> $block   Parsed block.
 * @param array<string, mixed> $context Block context; `postId` picks the post for core/post-content.
 * @return array<int, array<string, mixed>>
 */
function get_inner_blocks( array $block, array $context = [] ) : array {
	if ( 'core/template-part' === ( $block['blockName'] ?? '' ) ) {
		return get_template_part_blocks( $block );
	}

	if ( 'core/post-content' === ( $block['blockName'] ?? '' ) ) {
		return get_post_content_blocks( $block, $context );
	}

	if ( 'core/block' !== ( $block['blockName'] ?? '' ) ) {
		return $block['innerBlocks'] ?? [];
	}

	$ref       = (int) ( $block['attrs']['ref'] ?? 0 );
	$ancestors = $block['schemaOrgPatternRefs'] ?? [];
	if ( ! $ref || in_array( $ref, $ancestors, true ) ) {
		return [];
	}

	return tag_refs( get_pattern_blocks( $ref ), 'schemaOrgPatternRefs', array_merge( $ancestors, [ $ref ] ) );
}

/**
 * Get the parsed blocks of a published synced pattern, or none if it cannot be shown.
 *
 * Password-protected patterns are skipped, as core/block does when rendering.
 *
 * @param int $ref Pattern post ID.
 * @return array<int, array<string, mixed>>
 */
function get_pattern_blocks( int $ref ) : array {
	static $parsed = [];

	if ( ! isset( $parsed[ $ref ] ) ) {
		$pattern        = get_post( $ref );
		$is_visible     = $pattern && 'wp_block' === $pattern->post_type && 'publish' === $pattern->post_status && '' === $pattern->post_password;
		$parsed[ $ref ] = $is_visible ? parse_blocks( $pattern->post_content ) : [];
	}

	return $parsed[ $ref ];
}

/**
 * Record the posts a block tree was resolved through, so self-referencing content stops.
 *
 * @param array<int, array<string, mixed>> $blocks Parsed blocks.
 * @param string                           $key    Attribute-free key to store the refs under.
 * @param array<int, int>                  $refs   Post IDs.
 * @return array<int, array<string, mixed>>
 */
function tag_refs( array $blocks, string $key, array $refs ) : array {
	foreach ( $blocks as &$block ) {
		$block[ $key ]        = $refs;
		$block['innerBlocks'] = tag_refs( $block['innerBlocks'] ?? [], $key, $refs );
	}

	return $blocks;
}

/**
 * Get the parsed blocks of the template part a core/template-part block shows.
 *
 * @param array<string, mixed> $block Parsed core/template-part block.
 * @return array<int, array<string, mixed>>
 */
function get_template_part_blocks( array $block ) : array {
	static $parsed = [];

	$slug  = sanitize_key( (string) ( $block['attrs']['slug'] ?? '' ) );
	$theme = (string) ( $block['attrs']['theme'] ?? get_stylesheet() );

	if ( '' === $slug ) {
		return [];
	}

	$key = $theme . '//' . $slug;

	if ( ! isset( $parsed[ $key ] ) ) {
		$template       = get_block_template( $key, 'wp_template_part' );
		$parsed[ $key ] = $template && $template->content ? parse_blocks( $template->content ) : [];
	}

	return $parsed[ $key ];
}

/**
 * Get the parsed blocks of the post a core/post-content block shows.
 *
 * Password-protected posts give no blocks, and a post is not resolved inside itself.
 *
 * @param array<string, mixed> $block   Parsed core/post-content block.
 * @param array<string, mixed> $context Block context with `postId`; defaults to the current post.
 * @return array<int, array<string, mixed>>
 */
function get_post_content_blocks( array $block, array $context ) : array {
	static $parsed = [];

	$post_id   = (int) ( $context['postId'] ?? get_the_ID() );
	$ancestors = $block['schemaOrgPostRefs'] ?? [];

	if ( ! $post_id || in_array( $post_id, $ancestors, true ) ) {
		return [];
	}

	if ( ! isset( $parsed[ $post_id ] ) ) {
		$post               = get_post( $post_id );
		$parsed[ $post_id ] = $post && ! post_password_required( $post ) ? parse_blocks( $post->post_content ) : [];
	}

	return tag_refs( $parsed[ $post_id ], 'schemaOrgPostRefs', array_merge( $ancestors, [ $post_id ] ) );
}
