/**
 * Schema.org Blocks - Block Editor Extensions
 *
 * @package
 */

import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import {
	InspectorControls,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import { useDispatch, useSelect } from '@wordpress/data';
import { PanelBody } from '@wordpress/components';
import { Fragment, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import SchemaTypeSelector from './components/SchemaTypeSelector';
import AttributeMappingControls from './components/AttributeMappingControls';
import SchemaPresets from './components/SchemaPresets';
import {
	findParentType,
	getPropertyCandidates,
	getSmartDefaults,
	isTypeOrSubtype,
	propertyAcceptsType,
	shouldApplyDefaults,
} from './utils/smart-defaults';

import './variations';
import './editor.scss';

/**
 * Add schemaOrg attribute to all blocks.
 */
addFilter(
	'blocks.registerBlockType',
	'schema-org-blocks/add-attributes',
	( settings ) => {
		if ( ! settings.attributes ) {
			settings.attributes = {};
		}

		settings.attributes.schemaOrg = {
			type: 'object',
			default: {
				type: null,
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

		return (
			<Fragment>
				<BlockEdit { ...props } />
				<InspectorControls>
					<PanelBody
						title={ __(
							'Schema.org Mapping',
							'schema-org-blocks'
						) }
						initialOpen={ false }
					>
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
									// A site-wide id only stays with the same type or a subtype.
									...( schemaOrg.id &&
									! (
										type &&
										schemaOrg.type &&
										isTypeOrSubtype( type, schemaOrg.type )
									)
										? { id: undefined }
										: {} ),
								} )
							}
							isProperty={ schemaOrg.isProperty }
							propertyName={ schemaOrg.propertyName }
							onPropertyChange={ ( propertyName, isProperty ) =>
								updateSchemaOrg(
									isProperty
										? {
												propertyName,
												isProperty,
												skipDefaults: false,
												// Drop a value type the new property does not accept.
												...( schemaOrg.type &&
												! propertyAcceptsType(
													parentType,
													propertyName,
													schemaOrg.type
												)
													? {
															type: null,
															mappings: {},
														}
													: {} ),
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

						{ /* Only show property mappings for blocks with their own schema type.
						     Child blocks that are properties of a parent use the isProperty
						     toggle above — their value comes from block content automatically. */ }
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
					</PanelBody>
				</InspectorControls>
			</Fragment>
		);
	};
}, 'withSchemaOrgControls' );

addFilter(
	'editor.BlockEdit',
	'schema-org-blocks/with-inspector-controls',
	withSchemaOrgControls
);
