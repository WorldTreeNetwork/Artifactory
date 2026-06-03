<script lang="ts">
	import { page } from '$app/state';
	import { theme, resolvedTheme, toggleTheme } from '$lib/stores/theme';

	let { children } = $props();

	const navItems = [
		{
			href: '/pipelines',
			label: 'Pipelines',
			icon: 'pipelines'
		},
		{
			href: '/assets',
			label: 'Assets',
			icon: 'assets'
		},
		{
			href: '/adapters',
			label: 'Adapters',
			icon: 'adapters'
		},
		{
			href: '/runs',
			label: 'Runs',
			icon: 'runs'
		}
	] as const;

	function isActive(href: string): boolean {
		return page.url.pathname === href || page.url.pathname.startsWith(href + '/');
	}
</script>

<div class="app-shell">
	<!-- Sidebar -->
	<nav class="sidebar" aria-label="Primary navigation">
		<!-- Nav links -->
		<ul class="nav-list" role="list">
			{#each navItems as item}
				<li>
					<a
						href={item.href}
						class="nav-link"
						class:active={isActive(item.href)}
						title={item.label}
						aria-label={item.label}
						aria-current={isActive(item.href) ? 'page' : undefined}
					>
						{#if item.icon === 'pipelines'}
							<!-- Grid/flow icon for Pipelines -->
							<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
								<rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
								<rect x="12" y="2" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
								<rect x="2" y="12" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
								<rect x="12" y="12" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
								<path d="M8 5h4M8 15h4M5 8v4M15 8v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
							</svg>
						{:else if item.icon === 'assets'}
							<!-- Box icon for Assets -->
							<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
								<path d="M16.5 6.5L10 3L3.5 6.5V13.5L10 17L16.5 13.5V6.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
								<path d="M3.5 6.5L10 10M10 10L16.5 6.5M10 10V17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
							</svg>
						{:else if item.icon === 'adapters'}
							<!-- Plug icon for Adapters -->
							<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
								<path d="M7 2v4M13 2v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
								<rect x="4" y="6" width="12" height="5" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
								<path d="M10 11v3M10 14c-2 0-3 1-3 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
								<circle cx="10" cy="17" r="1" fill="currentColor"/>
							</svg>
						{:else if item.icon === 'runs'}
							<!-- Activity/runs icon -->
							<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
								<polyline points="2,12 5,8 8,13 11,6 14,10 17,7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						{/if}
					</a>
				</li>
			{/each}
		</ul>

		<!-- Bottom section: Settings + Theme toggle -->
		<div class="sidebar-bottom">
			<a
				href="/settings"
				class="nav-link"
				class:active={isActive('/settings')}
				title="Settings"
				aria-label="Settings"
				aria-current={isActive('/settings') ? 'page' : undefined}
			>
				<!-- Gear icon for Settings -->
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
					<circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5"/>
					<path d="M10 2.5V4M10 16v1.5M17.5 10H16M4 10H2.5M15.36 4.64l-1.06 1.06M5.7 14.3l-1.06 1.06M15.36 15.36l-1.06-1.06M5.7 5.7L4.64 4.64" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
				</svg>
			</a>

			<button
				class="nav-link theme-toggle"
				onclick={toggleTheme}
				title="Toggle theme ({resolvedTheme === 'dark' ? 'dark' : 'light'} mode)"
				aria-label="Toggle theme"
			>
				{#if resolvedTheme === 'dark'}
					<!-- Moon icon -->
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
						<path d="M17 13A7 7 0 0 1 7 3a7 7 0 1 0 10 10z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				{:else}
					<!-- Sun icon -->
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
						<circle cx="10" cy="10" r="3.5" stroke="currentColor" stroke-width="1.5"/>
						<path d="M10 2v1.5M10 16.5V18M18 10h-1.5M3.5 10H2M15.36 4.64l-1.06 1.06M5.7 14.3l-1.06 1.06M15.36 15.36l-1.06-1.06M5.7 5.7L4.64 4.64" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
				{/if}
			</button>
		</div>
	</nav>

	<!-- Main content -->
	<main class="main-content">
		{@render children()}
	</main>
</div>

<style>
	.app-shell {
		display: flex;
		height: 100vh;
		overflow: hidden;
		background-color: var(--color-bg-primary);
		color: var(--color-text-primary);
	}

	.sidebar {
		display: flex;
		flex-direction: column;
		width: var(--sidebar-width-collapsed);
		flex-shrink: 0;
		background-color: var(--color-bg-secondary);
		border-right: 1px solid var(--color-border-primary);
		z-index: var(--z-sidebar);
		overflow: hidden;
	}

	.nav-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 4px;
		margin: 0;
		list-style: none;
		flex: 1;
	}

	.sidebar-bottom {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 4px;
		border-top: 1px solid var(--color-border-primary);
	}

	.nav-link {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
		text-decoration: none;
		transition: background-color var(--duration-fast) var(--easing-default),
			color var(--duration-fast) var(--easing-default);
		border: none;
		background: none;
		cursor: pointer;
		padding: 0;
	}

	.nav-link:hover {
		background-color: var(--color-bg-surface-hover);
		color: var(--color-text-primary);
	}

	.nav-link.active {
		background-color: var(--color-bg-surface-selected);
		color: var(--color-text-primary);
	}

	.nav-link:focus-visible {
		outline: 2px solid var(--color-border-focus);
		outline-offset: 2px;
	}

	.main-content {
		flex: 1;
		overflow: auto;
		min-width: 0;
	}
</style>
