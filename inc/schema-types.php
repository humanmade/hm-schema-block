<?php
/**
 * Schema.org type and property definitions.
 *
 * @package SchemaOrgBlocks
 */

namespace SchemaOrgBlocks\SchemaTypes;

/**
 * Get all schema.org types with their hierarchies and properties.
 *
 * @return array<string, array<string, mixed>>
 */
function get_schema_types() : array {
	$types = [
		'Thing'           => [
			'label'      => 'Thing',
			'parent'     => null,
			'properties' => [
				'name'             => [
					'type'  => 'Text',
					'label' => 'Name',
				],
				'description'      => [
					'type'  => 'Text',
					'label' => 'Description',
				],
				'url'              => [
					'type'  => 'URL',
					'label' => 'URL',
				],
				'image'            => [
					'type'  => [ 'ImageObject', 'URL' ],
					'label' => 'Image',
				],
				'identifier'       => [
					'type'  => 'Text',
					'label' => 'Identifier',
				],
				'alternateName'    => [
					'type'  => 'Text',
					'label' => 'Alternate Name',
				],
				'sameAs'           => [
					'type'  => 'URL',
					'label' => 'Same As',
				],
				'mainEntityOfPage' => [
					'type'  => [ 'CreativeWork', 'URL' ],
					'label' => 'Main Entity Of Page',
				],
			],
		],
		'Article'         => [
			'label'      => 'Article',
			'parent'     => 'CreativeWork',
			'required'   => [ 'headline', 'author', 'publisher', 'datePublished' ],
			'properties' => [
				'headline'      => [
					'type'  => 'Text',
					'label' => 'Headline',
				],
				'articleBody'   => [
					'type'  => 'Text',
					'label' => 'Article Body',
				],
				'datePublished' => [
					'type'  => 'DateTime',
					'label' => 'Date Published',
				],
				'dateModified'  => [
					'type'  => 'DateTime',
					'label' => 'Date Modified',
				],
				'author'        => [
					'type'  => [ 'Person', 'Organization' ],
					'label' => 'Author',
				],
				'publisher'     => [
					'type'  => 'Organization',
					'label' => 'Publisher',
				],
			],
		],
		'BlogPosting'     => [
			'label'      => 'Blog Posting',
			'parent'     => 'Article',
			'properties' => [],
		],
		'NewsArticle'     => [
			'label'      => 'News Article',
			'parent'     => 'Article',
			'properties' => [],
		],
		'CreativeWork'    => [
			'label'      => 'Creative Work',
			'parent'     => 'Thing',
			'properties' => [
				'author'        => [
					'type'  => [ 'Person', 'Organization' ],
					'label' => 'Author',
				],
				'datePublished' => [
					'type'  => 'DateTime',
					'label' => 'Date Published',
				],
				'dateModified'  => [
					'type'  => 'DateTime',
					'label' => 'Date Modified',
				],
				'headline'      => [
					'type'  => 'Text',
					'label' => 'Headline',
				],
				'text'          => [
					'type'  => 'Text',
					'label' => 'Text',
				],
				'publisher'     => [
					'type'  => [ 'Organization', 'Person' ],
					'label' => 'Publisher',
				],
				'keywords'      => [
					'type'  => 'Text',
					'label' => 'Keywords',
				],
				'hasPart'       => [
					'type'  => 'CreativeWork',
					'label' => 'Has Part',
				],
				'inLanguage'    => [
					'type'  => 'Text',
					'label' => 'Language',
				],
				'isPartOf'      => [
					'type'  => 'CreativeWork',
					'label' => 'Is Part Of',
				],
			],
		],
		'WebPage'         => [
			'label'      => 'Web Page',
			'parent'     => 'CreativeWork',
			'properties' => [
				'mainEntity' => [
					'type'  => 'Thing',
					'label' => 'Main Entity',
				],
				'breadcrumb' => [
					'type'  => 'BreadcrumbList',
					'label' => 'Breadcrumb',
				],
			],
		],
		'FAQPage'         => [
			'label'      => 'FAQ Page',
			'parent'     => 'WebPage',
			'required'   => [ 'mainEntity' ],
			'properties' => [
				'mainEntity' => [
					'type'  => 'Question',
					'label' => 'Questions',
				],
			],
		],
		'Comment'         => [
			'label'      => 'Comment',
			'parent'     => 'CreativeWork',
			'properties' => [],
		],
		'Question'        => [
			'label'      => 'Question',
			'parent'     => 'Comment',
			'required'   => [ 'name', 'acceptedAnswer' ],
			'properties' => [
				'acceptedAnswer'  => [
					'type'  => [ 'Answer', 'ItemList' ],
					'label' => 'Accepted Answer',
				],
				'suggestedAnswer' => [
					'type'  => [ 'Answer', 'ItemList' ],
					'label' => 'Suggested Answer',
				],
			],
		],
		'Answer'          => [
			'label'      => 'Answer',
			'parent'     => 'Comment',
			'required'   => [ 'text' ],
			'properties' => [],
		],
		'HowTo'           => [
			'label'      => 'How-to',
			'parent'     => 'CreativeWork',
			'required'   => [ 'name', 'step' ],
			'properties' => [
				'step'      => [
					'type'  => [ 'HowToStep', 'HowToSection', 'Text' ],
					'label' => 'Steps',
				],
				'totalTime' => [
					'type'  => 'Duration',
					'label' => 'Total Time',
				],
				'supply'    => [
					'type'  => [ 'HowToSupply', 'Text' ],
					'label' => 'Supply',
				],
				'tool'      => [
					'type'  => [ 'HowToTool', 'Text' ],
					'label' => 'Tool',
				],
				'yield'     => [
					'type'  => 'Text',
					'label' => 'Yield',
				],
			],
		],
		'HowToStep'       => [
			'label'      => 'How-to Step',
			'parent'     => 'CreativeWork',
			'required'   => [ 'text' ],
			'properties' => [],
		],
		'WebSite'         => [
			'label'      => 'Web Site',
			'parent'     => 'CreativeWork',
			'required'   => [ 'name', 'url' ],
			'properties' => [],
		],
		'Blog'            => [
			'label'      => 'Blog',
			'parent'     => 'CreativeWork',
			'properties' => [
				'blogPost' => [
					'type'  => 'BlogPosting',
					'label' => 'Blog Posts',
				],
			],
		],
		'ItemList'        => [
			'label'      => 'Item List',
			'parent'     => 'Thing',
			'required'   => [ 'itemListElement' ],
			'properties' => [
				'itemListElement' => [
					'type'  => [ 'ListItem', 'Thing', 'Text' ],
					'label' => 'Items',
				],
				'numberOfItems'   => [
					'type'  => 'Integer',
					'label' => 'Number of Items',
				],
			],
		],
		'BreadcrumbList'  => [
			'label'      => 'Breadcrumb List',
			'parent'     => 'ItemList',
			'properties' => [],
		],
		'ListItem'        => [
			'label'      => 'List Item',
			'parent'     => 'Thing',
			'properties' => [
				'position' => [
					'type'  => 'Integer',
					'label' => 'Position',
				],
				'item'     => [
					'type'  => 'Thing',
					'label' => 'Item',
				],
			],
		],
		'Organization'    => [
			'label'      => 'Organization',
			'parent'     => 'Thing',
			'required'   => [ 'name' ],
			'properties' => [
				'logo'         => [
					'type'  => [ 'ImageObject', 'URL' ],
					'label' => 'Logo',
				],
				'address'      => [
					'type'  => 'PostalAddress',
					'label' => 'Address',
				],
				'contactPoint' => [
					'type'  => 'ContactPoint',
					'label' => 'Contact Point',
				],
				'email'        => [
					'type'  => 'Text',
					'label' => 'Email',
				],
				'telephone'    => [
					'type'  => 'Text',
					'label' => 'Telephone',
				],
				'foundingDate' => [
					'type'  => 'Date',
					'label' => 'Founding Date',
				],
			],
		],
		'LocalBusiness'   => [
			'label'      => 'Local Business',
			'parent'     => 'Organization',
			'required'   => [ 'name', 'address' ],
			'properties' => [
				'priceRange'   => [
					'type'  => 'Text',
					'label' => 'Price Range',
				],
				'openingHours' => [
					'type'  => 'Text',
					'label' => 'Opening Hours',
				],
			],
		],
		'Person'          => [
			'label'      => 'Person',
			'parent'     => 'Thing',
			'required'   => [ 'name' ],
			'properties' => [
				'givenName'  => [
					'type'  => 'Text',
					'label' => 'Given Name',
				],
				'familyName' => [
					'type'  => 'Text',
					'label' => 'Family Name',
				],
				'email'      => [
					'type'  => 'Text',
					'label' => 'Email',
				],
				'telephone'  => [
					'type'  => 'Text',
					'label' => 'Telephone',
				],
				'jobTitle'   => [
					'type'  => 'Text',
					'label' => 'Job Title',
				],
				'worksFor'   => [
					'type'  => 'Organization',
					'label' => 'Works For',
				],
			],
		],
		'Place'           => [
			'label'      => 'Place',
			'parent'     => 'Thing',
			'properties' => [
				'address'                   => [
					'type'  => 'PostalAddress',
					'label' => 'Address',
				],
				'geo'                       => [
					'type'  => 'GeoCoordinates',
					'label' => 'Geo Coordinates',
				],
				'telephone'                 => [
					'type'  => 'Text',
					'label' => 'Telephone',
				],
				'openingHoursSpecification' => [
					'type'  => 'OpeningHoursSpecification',
					'label' => 'Opening Hours',
				],
			],
		],
		'Accommodation'   => [
			'label'      => 'Accommodation',
			'parent'     => 'Place',
			'properties' => [
				'numberOfRooms'  => [
					'type'  => 'Number',
					'label' => 'Number of Rooms',
				],
				'amenityFeature' => [
					'type'  => 'LocationFeatureSpecification',
					'label' => 'Amenity Feature',
				],
			],
		],
		'Room'            => [
			'label'      => 'Room',
			'parent'     => 'Accommodation',
			'properties' => [],
		],
		'Product'         => [
			'label'      => 'Product',
			'parent'     => 'Thing',
			'required'   => [ 'name', [ 'offers', 'review', 'aggregateRating' ] ],
			'properties' => [
				'brand'           => [
					'type'  => [ 'Brand', 'Organization' ],
					'label' => 'Brand',
				],
				'offers'          => [
					'type'  => 'Offer',
					'label' => 'Offers',
				],
				'aggregateRating' => [
					'type'  => 'AggregateRating',
					'label' => 'Aggregate Rating',
				],
				'review'          => [
					'type'  => 'Review',
					'label' => 'Review',
				],
				'sku'             => [
					'type'  => 'Text',
					'label' => 'SKU',
				],
			],
		],
		'Event'           => [
			'label'      => 'Event',
			'parent'     => 'Thing',
			'required'   => [ 'name', 'startDate', 'location' ],
			'properties' => [
				'startDate' => [
					'type'  => 'DateTime',
					'label' => 'Start Date',
				],
				'endDate'   => [
					'type'  => 'DateTime',
					'label' => 'End Date',
				],
				'location'  => [
					'type'  => [ 'Place', 'VirtualLocation' ],
					'label' => 'Location',
				],
				'organizer' => [
					'type'  => [ 'Person', 'Organization' ],
					'label' => 'Organizer',
				],
				'performer' => [
					'type'  => [ 'Person', 'Organization' ],
					'label' => 'Performer',
				],
			],
		],
		'ImageObject'     => [
			'label'      => 'Image Object',
			'parent'     => 'MediaObject',
			'required'   => [ [ 'contentUrl', 'url' ] ],
			'properties' => [
				'contentUrl' => [
					'type'  => 'URL',
					'label' => 'Content URL',
				],
				'width'      => [
					'type'  => 'Number',
					'label' => 'Width',
				],
				'height'     => [
					'type'  => 'Number',
					'label' => 'Height',
				],
				'caption'    => [
					'type'  => 'Text',
					'label' => 'Caption',
				],
			],
		],
		'MediaObject'     => [
			'label'      => 'Media Object',
			'parent'     => 'CreativeWork',
			'properties' => [
				'contentUrl'     => [
					'type'  => 'URL',
					'label' => 'Content URL',
				],
				'encodingFormat' => [
					'type'  => 'Text',
					'label' => 'Encoding Format',
				],
			],
		],
		'PostalAddress'   => [
			'label'      => 'Postal Address',
			'parent'     => 'ContactPoint',
			'properties' => [
				'streetAddress'   => [
					'type'  => 'Text',
					'label' => 'Street Address',
				],
				'addressLocality' => [
					'type'  => 'Text',
					'label' => 'City',
				],
				'addressRegion'   => [
					'type'  => 'Text',
					'label' => 'Region',
				],
				'postalCode'      => [
					'type'  => 'Text',
					'label' => 'Postal Code',
				],
				'addressCountry'  => [
					'type'  => 'Text',
					'label' => 'Country',
				],
			],
		],
		'ContactPoint'    => [
			'label'      => 'Contact Point',
			'parent'     => 'Thing',
			'properties' => [
				'telephone'   => [
					'type'  => 'Text',
					'label' => 'Telephone',
				],
				'email'       => [
					'type'  => 'Text',
					'label' => 'Email',
				],
				'contactType' => [
					'type'  => 'Text',
					'label' => 'Contact Type',
				],
			],
		],
		'GeoCoordinates'  => [
			'label'      => 'Geo Coordinates',
			'parent'     => 'Thing',
			'properties' => [
				'latitude'  => [
					'type'  => 'Number',
					'label' => 'Latitude',
				],
				'longitude' => [
					'type'  => 'Number',
					'label' => 'Longitude',
				],
			],
		],
		'Offer'           => [
			'label'      => 'Offer',
			'parent'     => 'Thing',
			'required'   => [ 'price', 'priceCurrency' ],
			'properties' => [
				'price'         => [
					'type'  => 'Number',
					'label' => 'Price',
				],
				'priceCurrency' => [
					'type'  => 'Text',
					'label' => 'Price Currency',
				],
				'availability'  => [
					'type'  => 'Text',
					'label' => 'Availability',
				],
				'url'           => [
					'type'  => 'URL',
					'label' => 'URL',
				],
			],
		],
		'Review'          => [
			'label'      => 'Review',
			'parent'     => 'CreativeWork',
			'required'   => [ 'author', 'reviewRating' ],
			'properties' => [
				'reviewRating' => [
					'type'  => 'Rating',
					'label' => 'Review Rating',
				],
				'author'       => [
					'type'  => [ 'Person', 'Organization' ],
					'label' => 'Author',
				],
			],
		],
		'Rating'          => [
			'label'      => 'Rating',
			'parent'     => 'Thing',
			'required'   => [ 'ratingValue' ],
			'properties' => [
				'ratingValue' => [
					'type'  => 'Number',
					'label' => 'Rating Value',
				],
				'bestRating'  => [
					'type'  => 'Number',
					'label' => 'Best Rating',
				],
				'worstRating' => [
					'type'  => 'Number',
					'label' => 'Worst Rating',
				],
			],
		],
		'AggregateRating' => [
			'label'      => 'Aggregate Rating',
			'parent'     => 'Rating',
			'required'   => [ 'ratingValue', [ 'ratingCount', 'reviewCount' ] ],
			'properties' => [
				'reviewCount' => [
					'type'  => 'Number',
					'label' => 'Review Count',
				],
			],
		],
	];

	return apply_filters( 'schema_org_blocks_types', $types );
}

/**
 * Get properties for a specific schema type, including inherited properties.
 *
 * @param string $type Schema type name.
 * @return array<string, array<string, mixed>>
 */
function get_type_properties( string $type ) : array {
	$all_types = get_schema_types();

	if ( ! isset( $all_types[ $type ] ) ) {
		return [];
	}

	$properties = $all_types[ $type ]['properties'] ?? [];

	// Inherit properties from parent types.
	$parent = $all_types[ $type ]['parent'] ?? null;
	while ( $parent && isset( $all_types[ $parent ] ) ) {
		$parent_properties = $all_types[ $parent ]['properties'] ?? [];
		$properties        = array_merge( $parent_properties, $properties );
		$parent            = $all_types[ $parent ]['parent'] ?? null;
	}

	return $properties;
}

/**
 * Get the properties a type needs for rich results, including those of its parent types.
 *
 * Schema.org has no required properties. These follow Google's rich result requirements, plus
 * author and publisher for articles. An entry that is an array means any one of those
 * properties will do.
 *
 * @param string $type Schema type name.
 * @return array<int, string|array<int, string>>
 */
function get_required_properties( string $type ) : array {
	$all_types = get_schema_types();
	$required  = [];
	$seen      = [];

	while ( $type && isset( $all_types[ $type ] ) && ! isset( $seen[ $type ] ) ) {
		$seen[ $type ] = true;

		foreach ( $all_types[ $type ]['required'] ?? [] as $property ) {
			$key = wp_json_encode( $property );

			if ( ! isset( $required[ $key ] ) ) {
				$required[ $key ] = $property;
			}
		}

		$type = $all_types[ $type ]['parent'] ?? null;
	}

	return array_values( $required );
}

/**
 * Get the required properties of every type.
 *
 * @return array<string, array<int, string|array<int, string>>>
 */
function get_all_required_properties() : array {
	$required = [];

	foreach ( array_keys( get_schema_types() ) as $type ) {
		$required[ $type ] = get_required_properties( $type );
	}

	return $required;
}

/**
 * Get child types of a given schema type.
 *
 * @param string $parent_type Parent schema type.
 * @return array<string, array<string, mixed>>
 */
function get_child_types( string $parent_type ) : array {
	$all_types = get_schema_types();
	$children  = [];

	foreach ( $all_types as $type_name => $type_data ) {
		if ( ( $type_data['parent'] ?? null ) === $parent_type ) {
			$children[ $type_name ] = $type_data;
		}
	}

	return $children;
}

/**
 * Check if a type is a subtype of another type.
 *
 * @param string $type Type to check.
 * @param string $parent_type Parent type to check against.
 * @return bool
 */
function is_subtype_of( string $type, string $parent_type ) : bool {
	$all_types = get_schema_types();

	if ( ! isset( $all_types[ $type ] ) ) {
		return false;
	}

	$current_parent = $all_types[ $type ]['parent'] ?? null;

	while ( $current_parent ) {
		if ( $current_parent === $parent_type ) {
			return true;
		}
		$current_parent = $all_types[ $current_parent ]['parent'] ?? null;
	}

	return false;
}

/**
 * Get all properties across all schema types.
 *
 * @return array<string, array<string, array<string, mixed>>>
 */
function get_all_properties() : array {
	$all_types  = get_schema_types();
	$properties = [];

	foreach ( $all_types as $type_name => $type_data ) {
		$properties[ $type_name ] = get_type_properties( $type_name );
	}

	return $properties;
}
