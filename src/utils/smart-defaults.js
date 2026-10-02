/**
 * Smart defaults: the schema configuration a block gets when it sits inside a typed parent.
 */

import { __ } from '@wordpress/i18n';

/**
 * Default rules by block name.
 *
 * `properties` lists candidate parent properties in order of preference, or is a function of
 * the block's attributes that returns them; the first one the parent type has is used. `repeatable` rules apply to every matching sibling, producing an
 * array; other rules apply to the first unconfigured sibling of that block type only.
 * `exceptParentTypes` lists parent types the rule does not apply in. `nested` rules make the
 * block a typed entity of its own, so its inner blocks are not properties of the outer type.
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
		nested: true,
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
	'core/post-title': {
		properties: [ 'headline', 'name' ],
	},
	'core/post-date': {
		properties: ( attributes ) =>
			attributes?.metadata?.bindings?.datetime?.args?.field ===
				'modified' || attributes?.displayType === 'modified'
				? [ 'dateModified' ]
				: [ 'datePublished' ],
	},
	'core/post-author-name': {
		properties: [ 'author' ],
	},
	'core/post-author': {
		properties: [ 'author' ],
	},
	'core/post-featured-image': {
		properties: [ 'image' ],
	},
	'core/post-excerpt': {
		properties: [ 'description' ],
	},
	'core/post-terms': {
		properties: [ 'keywords' ],
	},
	'core/site-title': {
		properties: [ 'name' ],
	},
	'core/site-tagline': {
		properties: [ 'description' ],
	},
	'core/site-logo': {
		properties: [ 'logo', 'image' ],
	},
	'core/post-template': {
		nested: true,
		properties: [ 'itemListElement', 'blogPost' ],
		build: ( propertyName ) => ( {
			type: 'BlogPosting',
			isProperty: true,
			propertyName,
			mappings: {},
		} ),
	},
	'core/details': {
		nested: true,
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
 * get smart defaults. `blocks` lists the block names that offer the preset.
 */
export const PRESETS = {
	faq: {
		label: __( 'FAQ', 'schema-org-blocks' ),
		blocks: [ 'core/accordion', 'core/group' ],
		schemaOrg: {
			type: 'FAQPage',
			mappings: {},
			isProperty: false,
			propertyName: null,
		},
	},
	howTo: {
		label: __( 'How-to', 'schema-org-blocks' ),
		blocks: [ 'core/accordion', 'core/group' ],
		schemaOrg: {
			type: 'HowTo',
			mappings: { name: { source: 'post', field: 'title' } },
			isProperty: false,
			propertyName: null,
		},
	},
	article: {
		label: __( 'Article', 'schema-org-blocks' ),
		blocks: [ 'core/group' ],
		schemaOrg: {
			type: 'Article',
			mappings: {
				url: { source: 'post', field: 'url' },
				inLanguage: { source: 'site', field: 'language' },
			},
			isProperty: false,
			propertyName: null,
		},
	},
	webPage: {
		label: __( 'Web page', 'schema-org-blocks' ),
		blocks: [ 'core/group' ],
		schemaOrg: {
			type: 'WebPage',
			contains: 'mainEntity',
			mappings: {
				'@id': { source: 'post', field: 'url' },
				url: { source: 'post', field: 'url' },
				name: { source: 'post', field: 'title' },
				isPartOf: { source: 'reference', id: 'website' },
				inLanguage: { source: 'site', field: 'language' },
			},
			isProperty: false,
			propertyName: null,
		},
	},
	organization: {
		label: __( 'Organization', 'schema-org-blocks' ),
		blocks: [ 'core/group' ],
		schemaOrg: {
			type: 'Organization',
			id: 'organization',
			mappings: { url: { source: 'site', field: 'url' } },
			isProperty: false,
			propertyName: null,
		},
	},
	blog: {
		label: __( 'Blog', 'schema-org-blocks' ),
		blocks: [ 'core/query' ],
		schemaOrg: {
			type: 'Blog',
			mappings: {},
			isProperty: false,
			propertyName: null,
		},
	},
	itemList: {
		label: __( 'Item list', 'schema-org-blocks' ),
		blocks: [ 'core/query' ],
		schemaOrg: {
			type: 'ItemList',
			mappings: {},
			isProperty: false,
			propertyName: null,
		},
	},
};

/**
 * Get the presets a block offers.
 *
 * @param {string} blockName Block name.
 * @return {Array} [ key, preset ] pairs.
 */
export function getPresetsFor( blockName ) {
	return Object.entries( PRESETS ).filter( ( [ , preset ] ) =>
		preset.blocks.includes( blockName )
	);
}

/**
 * Whether a block's inner blocks are skipped when looking for property blocks of a type.
 *
 * The walk stops at a block with a type, a property block, a post template (its content
 * repeats per post), and a block whose smart default under that type makes it a nested entity:
 * its inner blocks belong to it, not to the outer type.
 *
 * @param {Object}      block      Block: `{ name, attributes }`.
 * @param {string|null} parentType Type the walk is looking for properties of.
 * @return {boolean} Whether the walk stops at this block.
 */
function stopsWalk( block, parentType ) {
	const schemaOrg = block.attributes?.schemaOrg || {};
	if (
		schemaOrg.type ||
		schemaOrg.isProperty ||
		block.name === 'core/post-template'
	) {
		return true;
	}
	return Boolean(
		RULES[ block.name ]?.nested &&
		getSmartDefaults( block.name, parentType, block.attributes )
	);
}

/**
 * Find the schema type a block's properties belong to: the closest typed ancestor, found
 * through untyped container blocks.
 *
 * @param {Object[]} ancestors Ancestor blocks, closest first: `{ name, attributes }`.
 * @return {string|null} Schema type, or null.
 */
export function findParentType( ancestors ) {
	const [ ancestor, ...rest ] = ancestors;

	if ( ! ancestor ) {
		return null;
	}

	if ( ancestor.attributes?.schemaOrg?.type ) {
		return ancestor.attributes.schemaOrg.type;
	}

	const typeAbove = findParentType( rest );
	return stopsWalk( ancestor, typeAbove ) ? null : typeAbove;
}

/**
 * List the blocks that can be properties of a typed block, in document order: its inner
 * blocks and, through untyped containers, theirs.
 *
 * @param {Object[]} blocks     Inner blocks of the typed block, from getBlocks().
 * @param {string}   parentType The typed block's schema type.
 * @return {Object[]} Blocks.
 */
export function getPropertyCandidates( blocks, parentType ) {
	return blocks.flatMap( ( block ) => [
		block,
		...( stopsWalk( block, parentType )
			? []
			: getPropertyCandidates( block.innerBlocks || [], parentType ) ),
	] );
}

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
 * @param {Object}      attributes The block's attributes, for rules that depend on them.
 * @return {Object|null} schemaOrg attribute value, or null when there is no default.
 */
export function getSmartDefaults( blockName, parentType, attributes = {} ) {
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

	const candidates =
		typeof rule.properties === 'function'
			? rule.properties( attributes )
			: rule.properties;
	const propertyName = candidates.find(
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
 * @param {Object[]} siblings   The typed ancestor's property candidates, including this block.
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

	const defaults = getSmartDefaults(
		block.name,
		parentType,
		block.attributes
	);

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
 * Inner blocks are walked through untyped containers. Blocks with a default get it, replacing
 * their current config. A block that becomes typed passes its type on to its own inner blocks. Blocks without a default are left alone, unless
 * they are mapped to a property the parent type does not have, which is cleared.
 *
 * @param {Object[]} blocks     Inner blocks of the typed block, from getBlocks().
 * @param {string}   parentType The typed block's schema type.
 * @return {Object} schemaOrg values keyed by client ID.
 */
export function getTreeDefaults( blocks, parentType ) {
	const updates = {};
	const claimed = new Set(
		getPropertyCandidates( blocks, parentType )
			.filter(
				( block ) =>
					! getSmartDefaults(
						block.name,
						parentType,
						block.attributes
					) && block.attributes?.schemaOrg?.isProperty
			)
			.map( ( block ) => block.attributes.schemaOrg.propertyName )
	);

	const parentProperties =
		window.schemaOrgBlocksData?.schemaProperties?.[ parentType ] || {};

	const visit = ( list ) =>
		list.forEach( ( block ) => {
			const defaults = getSmartDefaults(
				block.name,
				parentType,
				block.attributes
			);
			const current = block.attributes?.schemaOrg;

			if ( ! defaults ) {
				// Unlink blocks mapped to a property the new parent type does not have.
				const isStale =
					current?.isProperty &&
					! parentProperties[ current.propertyName ];
				if ( isStale ) {
					updates[ block.clientId ] = { ...EMPTY_CONFIG };
				}
				if ( isStale || ! stopsWalk( block, parentType ) ) {
					visit( block.innerBlocks || [] );
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

	visit( blocks );

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

/**
 * Whether a schema type is the same as, or a subtype of, another.
 *
 * @param {string} type     Schema type.
 * @param {string} ancestor Possible ancestor type.
 * @return {boolean} Whether `type` is `ancestor` or descends from it.
 */
export function isTypeOrSubtype( type, ancestor ) {
	const { schemaTypes = {} } = window.schemaOrgBlocksData || {};

	for (
		let current = type;
		current;
		current = schemaTypes[ current ]?.parent
	) {
		if ( current === ancestor ) {
			return true;
		}
	}

	return false;
}
