/**
 * Pre-publish panel that lists the structured data the post is missing.
 *
 * @package
 */

import apiFetch from '@wordpress/api-fetch';
import { Notice, Spinner } from '@wordpress/components';
import { select, useSelect } from '@wordpress/data';
import { PluginPrePublishPanel } from '@wordpress/editor';
import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { registerPlugin } from '@wordpress/plugins';

const ABILITY_PATH =
	'/wp-abilities/v1/abilities/schema-org-blocks/get-schema-graph/run';

/**
 * Get the label of a property, falling back to its name.
 *
 * @param {string} type     Schema type of the node.
 * @param {string} property Property name.
 * @return {string} Label.
 */
function getPropertyLabel( type, property ) {
	return (
		window.schemaOrgBlocksData?.schemaProperties?.[ type ]?.[ property ]
			?.label || property
	);
}

/**
 * Describe a missing property, or a list of which one is needed, e.g. "Headline" or "one of A, B".
 *
 * @param {string}          type     Schema type of the node.
 * @param {string|string[]} property Property name, or list of names.
 * @return {string} Description.
 */
function describeProperty( type, property ) {
	if ( ! Array.isArray( property ) ) {
		return getPropertyLabel( type, property );
	}

	return sprintf(
		/* translators: %s: comma-separated list of property labels. */
		__( 'one of %s', 'schema-org-blocks' ),
		property.map( ( name ) => getPropertyLabel( type, name ) ).join( ', ' )
	);
}

/**
 * Ask the get-schema-graph ability for the graph of the unsaved post and its template.
 *
 * @return {Promise<Object>} Ability result with `graph` and `missing`.
 */
function fetchGraph() {
	const editor = select( 'core/editor' );
	const query = new URLSearchParams( {
		'input[content]': editor.getEditedPostContent(),
		'input[post_id]': editor.getCurrentPostId(),
		'input[with_template]': 'true',
	} );

	return apiFetch( { path: `${ ABILITY_PATH }?${ query }` } );
}

/**
 * Pre-publish panel: loads the graph each time the publish panel opens, then shows what is missing.
 *
 * @return {Element|null} Panel, or null when closed or when there is no structured data.
 */
function SchemaPrePublish() {
	const isOpen = useSelect(
		( getSelect ) => getSelect( 'core/editor' ).isPublishSidebarOpened(),
		[]
	);
	const [ result, setResult ] = useState( null );
	const [ failed, setFailed ] = useState( false );

	useEffect( () => {
		setResult( null );
		setFailed( false );

		if ( ! isOpen ) {
			return undefined;
		}

		let isCurrent = true;

		fetchGraph().then(
			( data ) => isCurrent && setResult( data ),
			() => isCurrent && setFailed( true )
		);

		return () => {
			isCurrent = false;
		};
	}, [ isOpen ] );

	if ( ! isOpen ) {
		return null;
	}

	const title = __( 'Schema.org', 'schema-org-blocks' );

	if ( failed ) {
		return (
			<PluginPrePublishPanel title={ title } initialOpen>
				<p className="description">
					{ __(
						'The structured data could not be checked.',
						'schema-org-blocks'
					) }
				</p>
			</PluginPrePublishPanel>
		);
	}

	if ( ! result ) {
		return (
			<PluginPrePublishPanel title={ title } initialOpen>
				<Spinner />
			</PluginPrePublishPanel>
		);
	}

	if ( ! result.graph?.length ) {
		return null;
	}

	if ( ! result.missing?.length ) {
		return (
			<PluginPrePublishPanel title={ title } initialOpen>
				<p>
					{ __(
						'All required structured data is set.',
						'schema-org-blocks'
					) }
				</p>
			</PluginPrePublishPanel>
		);
	}

	return (
		<PluginPrePublishPanel title={ title } initialOpen>
			<Notice status="warning" isDismissible={ false }>
				{ __(
					'Some structured data is incomplete.',
					'schema-org-blocks'
				) }
			</Notice>
			<ul>
				{ result.missing.map( ( entry ) => (
					<li key={ JSON.stringify( entry ) }>
						{ sprintf(
							/* translators: 1: name of the entity, 2: schema.org type, 3: missing property labels. */
							__(
								'%1$s (%2$s): missing %3$s',
								'schema-org-blocks'
							),
							entry.label,
							entry.type,
							describeProperty( entry.type, entry.property )
						) }
					</li>
				) ) }
			</ul>
		</PluginPrePublishPanel>
	);
}

registerPlugin( 'schema-org-blocks-pre-publish', {
	render: SchemaPrePublish,
} );
