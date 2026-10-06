/**
 * Pre-publish panel that lists the problems the validator finds in the structured data of the post.
 *
 * @package
 */

import apiFetch from '@wordpress/api-fetch';
import { Button, Notice, Spinner } from '@wordpress/components';
import { select, useSelect } from '@wordpress/data';
import { PluginPrePublishPanel } from '@wordpress/editor';
import { useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { registerPlugin } from '@wordpress/plugins';

const GRAPH_PATH = '/schema-org-blocks/v1/graph';

/**
 * Ask for the graph of the unsaved post and its template, as the get-schema-graph ability does.
 *
 * @return {Promise<Object>} Result with `graph` and `issues`.
 */
function fetchGraph() {
	const editor = select( 'core/editor' );

	return apiFetch( {
		path: GRAPH_PATH,
		method: 'POST',
		data: {
			content: editor.getEditedPostContent(),
			post_id: editor.getCurrentPostId(),
			with_template: true,
		},
	} );
}

/**
 * Format an issue as a list line, e.g. "How long is delivery? (Question): Missing required property: Accepted Answer."
 *
 * @param {Object} issue Issue from the graph route.
 * @return {string} Line of text.
 */
function describeIssue( issue ) {
	if ( ! issue.type ) {
		return `${ issue.label }: ${ issue.message }`;
	}

	return sprintf(
		/* translators: 1: name of the entity, 2: schema.org type, 3: description of the problem. */
		__( '%1$s (%2$s): %3$s', 'schema-org-blocks' ),
		issue.label,
		issue.type,
		issue.message
	);
}

/**
 * List of issues.
 *
 * @param {Object}   props        Component props.
 * @param {Object[]} props.issues Issues to list.
 * @return {Element} List.
 */
function IssueList( { issues } ) {
	return (
		<ul>
			{ issues.map( ( issue, index ) => (
				// The list is rebuilt for each response and never reordered.
				<li key={ index }>{ describeIssue( issue ) }</li>
			) ) }
		</ul>
	);
}

/**
 * Pre-publish panel: loads the graph each time the publish panel opens, then lists the problems and suggestions.
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
	const [ showSuggestions, setShowSuggestions ] = useState( false );

	useEffect( () => {
		setResult( null );
		setFailed( false );
		setShowSuggestions( false );

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

	const issues = result.issues ?? [];
	const suggestions = issues.filter(
		( issue ) => 'missing_recommended' === issue.code
	);
	const problems = issues.filter(
		( issue ) => 'missing_recommended' !== issue.code
	);

	return (
		<PluginPrePublishPanel title={ title } initialOpen>
			{ problems.length ? (
				<>
					<Notice status="warning" isDismissible={ false }>
						{ __(
							'Some structured data is incomplete.',
							'schema-org-blocks'
						) }
					</Notice>
					<IssueList issues={ problems } />
				</>
			) : (
				<p>
					{ __(
						'All required structured data is set.',
						'schema-org-blocks'
					) }
				</p>
			) }
			{ suggestions.length > 0 && (
				<>
					<Button
						variant="link"
						aria-expanded={ showSuggestions }
						onClick={ () =>
							setShowSuggestions( ! showSuggestions )
						}
					>
						{ showSuggestions
							? __( 'Hide suggestions', 'schema-org-blocks' )
							: sprintf(
									/* translators: %d: number of suggestions. */
									_n(
										'Show %d suggestion',
										'Show %d suggestions',
										suggestions.length,
										'schema-org-blocks'
									),
									suggestions.length
								) }
					</Button>
					{ showSuggestions && <IssueList issues={ suggestions } /> }
				</>
			) }
		</PluginPrePublishPanel>
	);
}

registerPlugin( 'schema-org-blocks-pre-publish', {
	render: SchemaPrePublish,
} );
