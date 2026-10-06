<?php
/**
 * Validation of a schema graph with the schema.org validator library.
 *
 * @package SchemaOrgBlocks
 */

namespace SchemaOrgBlocks\Validation;

use HumanMade\SchemaOrgValidator\Issue;
use HumanMade\SchemaOrgValidator\Profile;
use HumanMade\SchemaOrgValidator\Profiles;
use HumanMade\SchemaOrgValidator\RuleProfile;
use HumanMade\SchemaOrgValidator\Validator;
use SchemaOrgBlocks\SchemaOutput;
use SchemaOrgBlocks\SchemaTypes;
use Throwable;

/**
 * Ids of the bundled Google profiles that are checked.
 */
const GOOGLE_PROFILES = [
	'google/article',
	'google/breadcrumb',
	'google/event',
	'google/job-posting',
	'google/local-business',
	'google/product-snippet',
	'google/profile-page',
	'google/qapage',
	'google/recipe',
	'google/review-snippet',
	'google/software-app',
	'google/video',
	'google/discussion-forum',
	'google/course-list',
	'google/education-qa',
];

/**
 * Check if the validator library is loaded.
 *
 * @return bool
 */
function is_available() : bool {
	return class_exists( Validator::class );
}

/**
 * Get the profiles a graph is checked against: the plugin's own and some of Google's.
 *
 * @return array<int, Profile>
 */
function get_profiles() : array {
	if ( ! is_available() ) {
		return [];
	}

	try {
		$profiles = array_merge(
			[ RuleProfile::fromFile( SCHEMA_ORG_BLOCKS_PATH . '/profiles/schema-org-blocks.json' ) ],
			Profiles::google( ...GOOGLE_PROFILES )
		);
	} catch ( Throwable $e ) {
		return [];
	}

	/**
	 * Filters the validator profiles used to check the structured data of a post.
	 *
	 * @param array<int, Profile> $profiles Profile objects.
	 */
	$profiles = apply_filters( 'schema_org_blocks_validation_profiles', $profiles );

	return array_values(
		array_filter(
			is_array( $profiles ) ? $profiles : [],
			static fn ( $profile ) => $profile instanceof Profile
		)
	);
}

/**
 * Check a graph against the schema.org vocabulary and the profiles.
 *
 * Never run on the front end. Notices are left out. Returns no issues when the validator library is not available.
 *
 * @param array<int, array<string, mixed>> $graph Schema objects.
 * @return array<int, array{severity: string, code: string, message: string, type: string|null, property: string|null, path: string, source: string, label: string}>
 */
function validate( array $graph ) : array {
	if ( ! $graph || ! is_available() ) {
		return [];
	}

	$validator = new Validator( null, ...get_profiles() );
	$report    = $validator->validate(
		[
			'@context' => 'https://schema.org',
			'@graph'   => $graph,
		]
	);
	$issues    = [];

	foreach ( $report->issues() as $issue ) {
		if ( Issue::NOTICE === $issue->severity() ) {
			continue;
		}

		$issues[] = [
			'severity' => $issue->severity(),
			'code'     => $issue->code(),
			'message'  => get_message( $issue ),
			'type'     => $issue->nodeType(),
			'property' => $issue->property(),
			'path'     => $issue->path(),
			'source'   => $issue->source(),
			'label'    => get_label( $graph, $issue ),
		];
	}

	usort(
		$issues,
		static fn ( $a, $b ) => ( Issue::ERROR === $b['severity'] ) <=> ( Issue::ERROR === $a['severity'] )
	);

	return $issues;
}

/**
 * Get the label of a property of a type, falling back to its name.
 *
 * Names of nested paths, and of alternatives joined with " or ", are described one by one.
 *
 * @param string|null $type     Schema type of the node.
 * @param string|null $property Property name.
 * @return string
 */
function get_property_label( ?string $type, ?string $property ) : string {
	$property = (string) $property;

	if ( str_contains( $property, ' or ' ) ) {
		$labels = array_map(
			static fn ( $name ) => get_property_label( $type, $name ),
			explode( ' or ', $property )
		);

		/* translators: %s: comma-separated list of property labels. */
		return sprintf( __( 'one of %s', 'schema-org-blocks' ), implode( ', ', $labels ) );
	}

	$properties = $type ? SchemaTypes\get_type_properties( $type ) : [];

	return $properties[ $property ]['label'] ?? $property;
}

/**
 * Get a readable message for an issue.
 *
 * @param Issue $issue Issue from the validator.
 * @return string
 */
function get_message( Issue $issue ) : string {
	$property = get_property_label( $issue->nodeType(), $issue->property() );

	switch ( $issue->code() ) {
		case 'missing_required':
			/* translators: %s: property label. */
			return sprintf( __( 'Missing required property: %s.', 'schema-org-blocks' ), $property );

		case 'missing_recommended':
			/* translators: %s: property label. */
			return sprintf( __( 'Missing recommended property: %s.', 'schema-org-blocks' ), $property );

		case 'unknown_property':
			/* translators: %s: property label. */
			return sprintf( __( '%s is not a schema.org property.', 'schema-org-blocks' ), $property );

		case 'property_not_for_type':
			/* translators: 1: property label, 2: schema.org type. */
			return sprintf( __( '%1$s is not used by %2$s.', 'schema-org-blocks' ), $property, (string) $issue->nodeType() );

		case 'unexpected_value_type':
			/* translators: %s: property label. */
			return sprintf( __( '%s has a value of a type it does not accept.', 'schema-org-blocks' ), $property );

		case 'invalid_value':
			/* translators: %s: property label. */
			return sprintf( __( '%s has an invalid value.', 'schema-org-blocks' ), $property );

		case 'superseded':
			/* translators: %s: property label, or schema.org type. */
			return sprintf( __( '%s is superseded.', 'schema-org-blocks' ), $issue->property() ? $property : (string) $issue->nodeType() );

		case 'unresolved_reference':
			return __( 'A reference points to a node that is not in the graph.', 'schema-org-blocks' );
	}

	return $issue->message();
}

/**
 * Get a name for the node an issue is about: its name, headline or @id, else its type.
 *
 * The node is found by following the path of the issue through the graph: the nearest object on the way that has the type of the issue, else the nearest object.
 *
 * @param array<int, array<string, mixed>> $graph Schema objects.
 * @param Issue                            $issue Issue from the validator.
 * @return string
 */
function get_label( array $graph, Issue $issue ) : string {
	$segments = array_map(
		static fn ( $segment ) => str_replace( [ '~1', '~0' ], [ '/', '~' ], $segment ),
		explode( '/', ltrim( $issue->path(), '/' ) )
	);

	if ( '@graph' === ( $segments[0] ?? '' ) ) {
		array_shift( $segments );
	}

	$type    = (string) $issue->nodeType();
	$current = $graph;
	$node    = null;
	$typed   = null;

	foreach ( $segments as $segment ) {
		if ( ! is_array( $current ) || ! array_key_exists( $segment, $current ) ) {
			break;
		}

		$current = $current[ $segment ];

		if ( is_array( $current ) && ! wp_is_numeric_array( $current ) ) {
			$node = $current;

			if ( in_array( $type, SchemaOutput\get_node_types( $current ), true ) ) {
				$typed = $current;
			}
		}
	}

	$node = $typed ?? $node;

	return $node ? SchemaOutput\get_node_label( $node, $type ) : $type;
}
