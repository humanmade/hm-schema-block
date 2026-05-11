/**
 * Schema.org Blocks - Block Editor Extensions
 *
 * @package
 */

import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { InspectorControls } from '@wordpress/block-editor';
import { PanelBody } from '@wordpress/components';
import { Fragment } from '@wordpress/element';

import SchemaTypeSelector from './components/SchemaTypeSelector';
import AttributeMappingControls from './components/AttributeMappingControls';
import {
	getSmartDefaults,
	shouldAutoApplyDefaults,
} from './utils/smart-defaults';

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
 * Add block context support.
 */
addFilter(
	'blocks.registerBlockType',
	'schema-org-blocks/add-context',
	( settings ) => {
		// Provide context.
		if ( ! settings.providesContext ) {
			settings.providesContext = {};
		}
		settings.providesContext[ 'schemaOrg/type' ] = 'schemaOrg';

		// Use context.
		if ( ! settings.usesContext ) {
			settings.usesContext = [];
		}
		if ( ! settings.usesContext.includes( 'schemaOrg/type' ) ) {
			settings.usesContext.push( 'schemaOrg/type' );
		}

		return settings;
	}
);

/**
 * Add Schema.org controls to block inspector.
 */
const withSchemaOrgControls = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		const { attributes, setAttributes, name, context } = props;
		const { schemaOrg = {} } = attributes;
		const parentSchemaContext = context[ 'schemaOrg/type' ];

		// Auto-apply smart defaults if applicable.
		if ( shouldAutoApplyDefaults( name, schemaOrg, parentSchemaContext ) ) {
			const defaults = getSmartDefaults( name, parentSchemaContext );
			if (
				defaults &&
				JSON.stringify( schemaOrg ) !== JSON.stringify( defaults )
			) {
				setAttributes( { schemaOrg: defaults } );
			}
		}

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
					<PanelBody title="Schema.org Mapping" initialOpen={ false }>
						<SchemaTypeSelector
							value={ schemaOrg.type }
							parentSchemaType={ parentSchemaContext?.type }
							onChange={ ( type ) => updateSchemaOrg( { type } ) }
							isProperty={ schemaOrg.isProperty }
							propertyName={ schemaOrg.propertyName }
							onPropertyChange={ ( propertyName, isProperty ) =>
								updateSchemaOrg( { propertyName, isProperty } )
							}
						/>

						{ ( schemaOrg.type || parentSchemaContext?.type ) && (
							<AttributeMappingControls
								blockName={ name }
								attributes={ attributes }
								schemaType={
									schemaOrg.type || parentSchemaContext?.type
								}
								mappings={ schemaOrg.mappings || {} }
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
