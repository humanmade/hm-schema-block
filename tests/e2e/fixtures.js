/**
 * Project fixtures on top of @wordpress/e2e-test-utils-playwright.
 * Specs import { test, expect } from here instead of from the package.
 */
const {
	test: base,
	expect,
} = require( '@wordpress/e2e-test-utils-playwright' );

const test = base.extend( {
	// Opens a new post with the welcome guide and fullscreen mode off, once
	// the editor canvas has loaded.
	newPost: async ( { admin, editor, page }, use ) => {
		await use( async () => {
			await admin.createNewPost();
			await editor.canvas.locator( 'body' ).waitFor();
			await editor.setPreferences( 'core/edit-post', {
				welcomeGuide: false,
				fullscreenMode: false,
			} );
			await expect(
				page.getByRole( 'dialog', { name: /^Welcome to/ } )
			).toBeHidden();
		} );
	},

	// Inserts a block, optionally inside a parent, and returns its client ID.
	// The new block becomes the selected block.
	insertBlock: async ( { editor, page }, use ) => {
		await use( async ( block, parentClientId ) => {
			await editor.insertBlock( block, { clientId: parentClientId } );
			return page.evaluate( () =>
				window.wp.data
					.select( 'core/block-editor' )
					.getSelectedBlockClientId()
			);
		} );
	},

	// The "Schema.org Mapping" panel for the selected block.
	schemaPanel: async ( { editor, page }, use ) => {
		const sidebar = page.getByRole( 'region', { name: 'Editor settings' } );

		const panel = {
			sidebar,

			async open() {
				await editor.openDocumentSettingsSidebar();
				const blockTab = sidebar.getByRole( 'tab', { name: 'Block' } );
				if (
					( await blockTab.getAttribute( 'aria-selected' ) ) !==
					'true'
				) {
					await blockTab.click();
				}
				// Some blocks (e.g. core/image in WP 7.x) split the inspector
				// into Content / Settings / Styles tabs; the panel is under Settings.
				const settingsTab = sidebar.getByRole( 'tab', {
					name: 'Settings',
					exact: true,
				} );
				if (
					( await settingsTab.count() ) > 0 &&
					( await settingsTab.getAttribute( 'aria-selected' ) ) !==
						'true'
				) {
					await settingsTab.click();
				}
				const toggle = sidebar.getByRole( 'button', {
					name: 'Schema.org Mapping',
				} );
				await expect( toggle ).toBeVisible();
				if (
					( await toggle.getAttribute( 'aria-expanded' ) ) !== 'true'
				) {
					await toggle.click();
				}
				await expect( toggle ).toHaveAttribute(
					'aria-expanded',
					'true'
				);
			},

			async setType( type ) {
				await panel.open();
				await sidebar.getByLabel( 'Schema Type' ).selectOption( type );
			},
		};

		await use( panel );
	},

	// Publishes the current post, opens it on the front end and returns the
	// parsed JSON-LD from <head>.
	publishAndGetJsonLd: async ( { editor, page }, use ) => {
		await use( async () => {
			const postId = await editor.publishPost();
			await page.goto( `/?p=${ postId }` );
			const script = page.locator(
				'head script[type="application/ld+json"]'
			);
			await expect( script ).toBeAttached();
			return JSON.parse( await script.textContent() );
		} );
	},
} );

module.exports = { test, expect };
