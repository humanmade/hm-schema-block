/**
 * Smart defaults: the schema configuration a block gets when it sits inside a typed parent.
 */

/**
 * Default rules by block name.
 *
 * `properties` lists candidate parent properties in order of preference; the first one the
 * parent type has is used. `repeatable` rules apply to every matching sibling, producing an
 * array; other rules apply to the first unconfigured sibling of that block type only.
 */
const RULES = {
	'core/heading': {
		properties: [ 'headline', 'name' ],
	},
	'core/paragraph': {
		properties: [ 'description', 'text' ],
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
};

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

	if ( ! rule || ! parentProperties ) {
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
