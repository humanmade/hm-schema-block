/**
 * Schema.org Blocks - Block Editor Extensions
 *
 * @package
 */

/* eslint-disable @wordpress/no-unsafe-wp-apis -- Layout components are only exported as experimental. */

import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import {
	InspectorControls,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import { useDispatch, useSelect } from '@wordpress/data';
import {
	PanelBody,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import { Fragment, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import SchemaTypeSelector, {
	getLockedValueType,
} from './components/SchemaTypeSelector';
import AttributeMappingControls from './components/AttributeMappingControls';
import SchemaPresets from './components/SchemaPresets';
import EntityControls from './components/EntityControls';
import {
	findParentType,
	getPropertyCandidates,
	getSmartDefaults,
	isTypeOrSubtype,
	propertyAcceptsType,
	shouldApplyDefaults,
} from './utils/smart-defaults';

import './variations';
import './pre-publish';

/**
 * Schema types blocks have when none is saved, as in PHP's get_default_config().
 */
const DEFAULT_TYPES = {
	'core/breadcrumbs': 'BreadcrumbList',
};

/**
 * Add schemaOrg attribute to all blocks.
 */
addFilter(
	'blocks.registerBlockType',
	'schema-org-blocks/add-attributes',
	( settings, name ) => {
		if ( ! settings.attributes ) {
			settings.attributes = {};
		}

		settings.attributes.schemaOrg = {
			type: 'object',
			default: {
				type: DEFAULT_TYPES[ name ] ?? null,
				mappings: {},
				isProperty: false,
				propertyName: null,
			},
		};

		return settings;
	}
);

/**
 * Add Schema.org controls to block inspector.
 */
const withSchemaOrgControls = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		const { attributes, setAttributes, name, clientId } = props;
		const { schemaOrg = {} } = attributes;

		// The typed ancestor this block's properties belong to, through untyped containers.
		const { parentType, parentClientId } = useSelect(
			( select ) => {
				const { getBlockParents, getBlock } =
					select( blockEditorStore );
				const ancestorIds = getBlockParents( clientId, true );
				const type = findParentType( ancestorIds.map( getBlock ) );
				return {
					parentType: type,
					parentClientId: type
						? ancestorIds.find(
								( id ) =>
									getBlock( id )?.attributes?.schemaOrg?.type
							)
						: null,
				};
			},
			[ clientId ]
		);

		// Properties already claimed by direct child blocks via isProperty, so
		// AttributeMappingControls can exclude them from the parent's picker.
		// Joined to a string so the selector returns a stable value.
		const claimedKey = useSelect(
			( select ) => {
				if ( ! schemaOrg.type ) {
					return '';
				}
				return getPropertyCandidates(
					select( blockEditorStore ).getBlocks( clientId ),
					schemaOrg.type
				)
					.filter( ( b ) => b.attributes?.schemaOrg?.isProperty )
					.map( ( b ) => b.attributes.schemaOrg.propertyName )
					.filter( Boolean )
					.join( ',' );
			},
			[ schemaOrg.type, clientId ]
		);
		const claimedProperties = claimedKey ? claimedKey.split( ',' ) : [];

		const applyDefaults = useSelect(
			( select ) => {
				if ( ! parentType ) {
					return false;
				}
				const { getBlock, getBlocks } = select( blockEditorStore );
				const block = getBlock( clientId );
				return (
					!! block &&
					shouldApplyDefaults(
						block,
						parentType,
						getPropertyCandidates(
							getBlocks( parentClientId ),
							parentType
						)
					)
				);
			},
			[ parentType, parentClientId, clientId ]
		);

		const { __unstableMarkNextChangeAsNotPersistent } =
			useDispatch( blockEditorStore );

		useEffect( () => {
			if ( ! applyDefaults ) {
				return;
			}
			const defaults = getSmartDefaults( name, parentType, attributes );
			if ( defaults ) {
				// Fold the change into the undo step that inserted or retyped the block.
				__unstableMarkNextChangeAsNotPersistent();
				setAttributes( { schemaOrg: defaults } );
			}
		}, [ applyDefaults ] ); // eslint-disable-line react-hooks/exhaustive-deps

		const updateSchemaOrg = ( updates ) => {
			setAttributes( {
				schemaOrg: {
					...schemaOrg,
					...updates,
				},
			} );
		};

		// The value type for a chosen property: its only type if it has just one,
		// otherwise the current type unless the property does not accept it.
		const getValueTypeUpdates = ( propertyName ) => {
			const lockedType = getLockedValueType( parentType, propertyName );
			if ( lockedType ) {
				return {
					type: lockedType,
					...( schemaOrg.type && schemaOrg.type !== lockedType
						? { mappings: {} }
						: {} ),
				};
			}
			if (
				schemaOrg.type &&
				! propertyAcceptsType(
					parentType,
					propertyName,
					schemaOrg.type
				)
			) {
				return { type: null, mappings: {} };
			}
			return {};
		};

		return (
			<Fragment>
				<BlockEdit { ...props } />
				<InspectorControls>
					<PanelBody
						title={ __( 'Schema.org', 'schema-org-blocks' ) }
						initialOpen={ false }
					>
						<VStack spacing={ 4 }>
							<SchemaPresets
								clientId={ clientId }
								blockName={ name }
								schemaOrg={ schemaOrg }
							/>
							<SchemaTypeSelector
								value={ schemaOrg.type }
								parentSchemaType={ parentType }
								onChange={ ( type ) =>
									updateSchemaOrg( {
										type,
										// Drop a nesting property the new type doesn't have.
										...( schemaOrg.contains &&
										! window.schemaOrgBlocksData
											?.schemaProperties?.[ type ]?.[
											schemaOrg.contains
										]
											? { contains: undefined }
											: {} ),
										// A site-wide id only stays with the same type or a subtype.
										...( schemaOrg.id &&
										! (
											type &&
											schemaOrg.type &&
											isTypeOrSubtype(
												type,
												schemaOrg.type
											)
										)
											? { id: undefined }
											: {} ),
									} )
								}
								isProperty={ schemaOrg.isProperty }
								propertyName={ schemaOrg.propertyName }
								onPropertyChange={ (
									propertyName,
									isProperty
								) =>
									updateSchemaOrg(
										isProperty
											? {
													propertyName,
													isProperty,
													skipDefaults: false,
													...getValueTypeUpdates(
														propertyName
													),
												}
											: {
													type: null,
													mappings: {},
													propertyName: null,
													isProperty: false,
													skipDefaults: true,
												}
									)
								}
							/>
						</VStack>
					</PanelBody>
					{ /* Only blocks with their own schema type map properties. Child blocks that
					     are properties of a parent get their value from block content. */ }
					{ schemaOrg.type && (
						<AttributeMappingControls
							attributes={ attributes }
							schemaType={ schemaOrg.type }
							mappings={ schemaOrg.mappings || {} }
							claimedProperties={ claimedProperties }
							onChange={ ( mappings ) =>
								updateSchemaOrg( { mappings } )
							}
						/>
					) }
				</InspectorControls>
				{ schemaOrg.type && (
					<InspectorControls group="advanced">
						<EntityControls
							schemaOrg={ schemaOrg }
							onChange={ updateSchemaOrg }
						/>
					</InspectorControls>
				) }
			</Fragment>
		);
	};
}, 'withSchemaOrgControls' );

addFilter(
	'editor.BlockEdit',
	'schema-org-blocks/with-inspector-controls',
	withSchemaOrgControls
);
