/**
 * Smart defaults utility for common block types.
 *
 * @package SchemaOrgBlocks
 */

/**
 * Get smart defaults for a block type based on parent schema context.
 *
 * @param {string} blockName Block name.
 * @param {Object|null} parentSchemaContext Parent schema context.
 * @return {Object|null} Smart defaults or null.
 */
export function getSmartDefaults( blockName, parentSchemaContext ) {
	const { schemaProperties } = window.schemaOrgBlocksData || {};

	if ( ! parentSchemaContext || ! parentSchemaContext.type ) {
		return null;
	}

	const parentType = parentSchemaContext.type;
	const parentProperties = schemaProperties?.[ parentType ] || {};

	// Smart defaults for core/image.
	if ( blockName === 'core/image' ) {
		// Check if parent has an image property that accepts ImageObject.
		const imageProps = Object.entries( parentProperties ).filter( ( [ propName, propConfig ] ) => {
			const types = Array.isArray( propConfig.type ) ? propConfig.type : [ propConfig.type ];
			return types.includes( 'ImageObject' ) || types.includes( 'URL' );
		} );

		if ( imageProps.length > 0 ) {
			const [ propName, propConfig ] = imageProps[ 0 ];
			const types = Array.isArray( propConfig.type ) ? propConfig.type : [ propConfig.type ];

			// If ImageObject is accepted, use it. Otherwise map as URL.
			if ( types.includes( 'ImageObject' ) ) {
				return {
					type: 'ImageObject',
					isProperty: true,
					propertyName: propName,
					mappings: {
						contentUrl: {
							source: 'attribute',
							attributeName: 'url',
						},
						caption: {
							source: 'attribute',
							attributeName: 'caption',
						},
						width: {
							source: 'attribute',
							attributeName: 'width',
						},
						height: {
							source: 'attribute',
							attributeName: 'height',
						},
					},
				};
			} else {
				// Map URL directly.
				return {
					type: null,
					isProperty: true,
					propertyName: propName,
					mappings: {
						[ propName ]: {
							source: 'attribute',
							attributeName: 'url',
						},
					},
				};
			}
		}
	}

	// Smart defaults for core/button.
	if ( blockName === 'core/button' ) {
		// Check for URL properties.
		const urlProps = Object.entries( parentProperties ).filter( ( [ propName, propConfig ] ) => {
			const types = Array.isArray( propConfig.type ) ? propConfig.type : [ propConfig.type ];
			return types.includes( 'URL' );
		} );

		if ( urlProps.length > 0 ) {
			const [ propName ] = urlProps[ 0 ];
			return {
				type: null,
				isProperty: true,
				propertyName: propName,
				mappings: {
					[ propName ]: {
						source: 'attribute',
						attributeName: 'url',
					},
				},
			};
		}
	}

	// Smart defaults for core/heading.
	if ( blockName === 'core/heading' ) {
		// Check for name or headline properties.
		if ( parentProperties.headline ) {
			return {
				type: null,
				isProperty: true,
				propertyName: 'headline',
				mappings: {
					headline: {
						source: 'content',
					},
				},
			};
		} else if ( parentProperties.name ) {
			return {
				type: null,
				isProperty: true,
				propertyName: 'name',
				mappings: {
					name: {
						source: 'content',
					},
				},
			};
		}
	}

	// Smart defaults for core/paragraph.
	if ( blockName === 'core/paragraph' ) {
		// Check for description or text properties.
		if ( parentProperties.description ) {
			return {
				type: null,
				isProperty: true,
				propertyName: 'description',
				mappings: {
					description: {
						source: 'content',
					},
				},
			};
		} else if ( parentProperties.text ) {
			return {
				type: null,
				isProperty: true,
				propertyName: 'text',
				mappings: {
					text: {
						source: 'content',
					},
				},
			};
		} else if ( parentProperties.articleBody ) {
			return {
				type: null,
				isProperty: true,
				propertyName: 'articleBody',
				mappings: {
					articleBody: {
						source: 'content',
					},
				},
			};
		}
	}

	return null;
}

/**
 * Check if smart defaults should be auto-applied.
 *
 * @param {string} blockName Block name.
 * @param {Object} currentSchemaOrg Current schemaOrg attribute.
 * @param {Object|null} parentSchemaContext Parent schema context.
 * @return {boolean} Whether to auto-apply defaults.
 */
export function shouldAutoApplyDefaults( blockName, currentSchemaOrg, parentSchemaContext ) {
	// Only apply if:
	// 1. Block has no schema configuration yet.
	// 2. There's a parent schema context.
	// 3. Block is a supported type.
	const supportedBlocks = [ 'core/image', 'core/button', 'core/heading', 'core/paragraph' ];

	if ( ! supportedBlocks.includes( blockName ) ) {
		return false;
	}

	if ( ! parentSchemaContext || ! parentSchemaContext.type ) {
		return false;
	}

	// Check if already configured.
	const isConfigured =
		currentSchemaOrg.type ||
		currentSchemaOrg.isProperty ||
		Object.keys( currentSchemaOrg.mappings || {} ).length > 0;

	return ! isConfigured;
}
