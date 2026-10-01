/**
 * Smart defaults: the schema configuration a block gets when it sits inside a typed parent.
 */

import { __ } from '@wordpress/i18n';

/**
 * Default rules by block name.
 *
 * `properties` lists candidate parent properties in order of preference; the first one the
 * parent type has is used. `repeatable` rules apply to every matching sibling, producing an
 * array; other rules apply to the first unconfigured sibling of that block type only.
 * `exceptParentTypes` lists parent types the rule does not apply in.
 */
const RULES = {
	'core/heading': {
		properties: [ 'headline', 'name' ],
		exceptParentTypes: [ 'Question', 'Answer', 'HowToStep' ],
	},
	'core/paragraph': {
		properties: [ 'description', 'text' ],
		exceptParentTypes: [ 'Question', 'Answer', 'HowToStep' ],
	},
	'core/image': {
		properties: [ 'image', 'logo' ],
		repeatable: true,
		build: ( propertyName, propertyConfig ) =>
			acceptsType( propertyConfig, 'ImageObject' )
				? {
						type: 'ImageObject',
						isProperty: true,
						propertyName,
						mappings: {
							contentUrl: {
								source: 'attribute',
								attributeName: 'url',
							},
							caption: {
								source: 'attribute',
								attributeName: 'caption',
							},
						},
					}
				: attributeProperty( propertyName, 'url' ),
	},
	'core/button': {
		properties: [ 'url' ],
		build: ( propertyName ) => attributeProperty( propertyName, 'url' ),
	},
	'core/accordion-item': {
		properties: [ 'mainEntity', 'step' ],
		repeatable: true,
		build: ( propertyName ) => ( {
			type: propertyName === 'step' ? 'HowToStep' : 'Question',
			isProperty: true,
			propertyName,
			mappings: {},
		} ),
	},
	'core/accordion-heading': {
		properties: [ 'name' ],
		build: ( propertyName ) => attributeProperty( propertyName, 'title' ),
	},
	'core/accordion-panel': {
		properties: [ 'acceptedAnswer', 'text' ],
	},
	'core/details': {
		properties: [ 'mainEntity', 'step' ],
		repeatable: true,
		build: ( propertyName ) => {
			const isStep = propertyName === 'step';
			return {
				type: isStep ? 'HowToStep' : 'Question',
				isProperty: true,
				propertyName,
				mappings: {
					name: { source: 'attribute', attributeName: 'summary' },
					[ isStep ? 'text' : 'acceptedAnswer' ]: {
						source: 'innerBlocks',
					},
				},
			};
		},
	},
};

/**
 * Presets offered on container blocks: a schema type for the block, whose inner blocks then
 * get smart defaults.
 */
export const PRESETS = {
	faq: {
		label: __( 'FAQ', 'schema-org-blocks' ),
		schemaOrg: {
			type: 'FAQPage',
			mappings: {},
			isProperty: false,
			propertyName: null,
		},
	},
	howTo: {
		label: __( 'How-to', 'schema-org-blocks' ),
		schemaOrg: {
			type: 'HowTo',
			mappings: { name: { source: 'post', field: 'title' } },
			isProperty: false,
			propertyName: null,
		},
	},
};

/**
 * Block names that get the preset buttons.
 */
export const PRESET_BLOCKS = [ 'core/accordion', 'core/group' ];

/**
 * Whether a property config accepts a schema type.
 *
 * @param {Object} propertyConfig Property config from schemaProperties.
 * @param {string} type           Schema type or data type.
 * @return {boolean} Whether the type is accepted.
 */
function acceptsType( propertyConfig, type ) {
	return [].concat( propertyConfig?.type ).includes( type );
}

/**
 * Config for an untyped property block whose value comes from one of its attributes.
 *
 * @param {string} propertyName  Parent property.
 * @param {string} attributeName Block attribute.
 * @return {Object} schemaOrg attribute value.
 */
function attributeProperty( propertyName, attributeName ) {
	return {
		type: null,
		isProperty: true,
		propertyName,
		mappings: {
			[ propertyName ]: { source: 'attribute', attributeName },
		},
	};
}

/**
 * Get the smart default config for a block inside a parent of the given type.
 *
 * @param {string}      blockName  Block name.
 * @param {string|null} parentType Parent block's schema type.
 * @return {Object|null} schemaOrg attribute value, or null when there is no default.
 */
export function getSmartDefaults( blockName, parentType ) {
	const rule = RULES[ blockName ];
	const parentProperties =
		window.schemaOrgBlocksData?.schemaProperties?.[ parentType ];

	if (
		! rule ||
		! parentProperties ||
		rule.exceptParentTypes?.includes( parentType )
	) {
		return null;
	}

	const propertyName = rule.properties.find(
		( property ) => parentProperties[ property ]
	);

	if ( ! propertyName ) {
		return null;
	}

	return rule.build
		? rule.build( propertyName, parentProperties[ propertyName ] )
		: { type: null, isProperty: true, propertyName, mappings: {} };
}

/**
 * Whether a block's schemaOrg attribute has been set up, or defaults were turned off for it.
 *
 * @param {Object} schemaOrg schemaOrg attribute value.
 * @return {boolean} Whether the block is configured.
 */
export function isConfigured( schemaOrg = {} ) {
	return Boolean(
		schemaOrg.type ||
		schemaOrg.isProperty ||
		schemaOrg.skipDefaults ||
		Object.keys( schemaOrg.mappings || {} ).length
	);
}

/**
 * Whether smart defaults should be applied to a block now.
 *
 * @param {Object}   block      The block: `{ clientId, name, attributes }`.
 * @param {string}   parentType Parent block's schema type.
 * @param {Object[]} siblings   The parent's inner blocks, including this block.
 * @return {boolean} Whether to apply defaults.
 */
export function shouldApplyDefaults( block, parentType, siblings ) {
	const rule = RULES[ block.name ];

	if (
		! rule ||
		! parentType ||
		isConfigured( block.attributes.schemaOrg )
	) {
		return false;
	}

	const defaults = getSmartDefaults( block.name, parentType );

	if ( ! defaults ) {
		return false;
	}

	if ( rule.repeatable ) {
		return true;
	}

	const claimed = siblings.some(
		( sibling ) =>
			sibling.attributes?.schemaOrg?.isProperty &&
			sibling.attributes.schemaOrg.propertyName === defaults.propertyName
	);

	const firstUnconfigured = siblings.find(
		( sibling ) =>
			sibling.name === block.name &&
			! isConfigured( sibling.attributes?.schemaOrg )
	);

	return ! claimed && firstUnconfigured?.clientId === block.clientId;
}

/**
 * The schemaOrg attribute of a block with no schema setup.
 */
const EMPTY_CONFIG = {
	type: null,
	mappings: {},
	isProperty: false,
	propertyName: null,
};

/**
 * Whether a block type has a smart default rule that repeats across siblings.
 *
 * @param {string} blockName Block name.
 * @return {boolean} Whether the rule is repeatable.
 */
function isRepeatable( blockName ) {
	return Boolean( RULES[ blockName ]?.repeatable );
}

/**
 * Work out smart defaults for a block tree, as if every block were newly inserted.
 *
 * Blocks with a default get it, replacing their current config. A block that becomes typed
 * passes its type on to its own inner blocks. Blocks without a default are left alone, unless
 * they are mapped to a property the parent type does not have, which is cleared.
 *
 * @param {Object[]} blocks     Inner blocks of the typed block, from getBlocks().
 * @param {string}   parentType The typed block's schema type.
 * @return {Object} schemaOrg values keyed by client ID.
 */
export function getTreeDefaults( blocks, parentType ) {
	const updates = {};
	const claimed = new Set(
		blocks
			.filter(
				( block ) =>
					! getSmartDefaults( block.name, parentType ) &&
					block.attributes?.schemaOrg?.isProperty
			)
			.map( ( block ) => block.attributes.schemaOrg.propertyName )
	);

	const parentProperties =
		window.schemaOrgBlocksData?.schemaProperties?.[ parentType ] || {};

	blocks.forEach( ( block ) => {
		const defaults = getSmartDefaults( block.name, parentType );
		const current = block.attributes?.schemaOrg;

		if ( ! defaults ) {
			// Unlink blocks mapped to a property the new parent type does not have.
			if (
				current?.isProperty &&
				! parentProperties[ current.propertyName ]
			) {
				updates[ block.clientId ] = { ...EMPTY_CONFIG };
			}
			return;
		}

		if ( ! isRepeatable( block.name ) ) {
			if ( claimed.has( defaults.propertyName ) ) {
				return;
			}
			claimed.add( defaults.propertyName );
		}

		updates[ block.clientId ] = defaults;

		if ( defaults.type ) {
			Object.assign(
				updates,
				getTreeDefaults( block.innerBlocks || [], defaults.type )
			);
		}
	} );

	return updates;
}

/**
 * Whether a parent's property accepts a schema type, directly or as a subtype.
 *
 * @param {string} parentType   Parent block's schema type.
 * @param {string} propertyName Property of the parent.
 * @param {string} type         Schema type to check.
 * @return {boolean} Whether the property accepts the type.
 */
export function propertyAcceptsType( parentType, propertyName, type ) {
	const { schemaTypes = {}, schemaProperties = {} } =
		window.schemaOrgBlocksData || {};
	const accepted = [].concat(
		schemaProperties[ parentType ]?.[ propertyName ]?.type || []
	);

	for (
		let current = type;
		current;
		current = schemaTypes[ current ]?.parent
	) {
		if ( accepted.includes( current ) ) {
			return true;
		}
	}

	return false;
}
