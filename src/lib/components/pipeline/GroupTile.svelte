<script lang="ts">
	import type { Snippet } from 'svelte';

	type LOD = 'overview' | 'working' | 'detail';

	interface Props {
		label?: string;
		children: Snippet;
		lod: LOD;
		branchCount?: number;
	}

	let { label = 'Parallel', children, lod, branchCount }: Props = $props();
</script>

<!--
  GroupTile: visual container for fan-out parallel branches.
  At overview LOD renders only the label + optional branch count badge.
  At working/detail LOD renders the full children (StepTiles).
-->
<div class="group-tile">
	<div class="group-header">
		<span class="group-label">{label}</span>
		{#if lod === 'overview' && branchCount !== undefined}
			<span class="branch-badge">{branchCount} branches</span>
		{:else if lod === 'overview'}
			<span class="branch-badge">branches</span>
		{/if}
	</div>

	{#if lod !== 'overview'}
		<div class="group-children">
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.group-tile {
		box-sizing: border-box;
		border: 2px dashed var(--color-border-subtle);
		border-radius: var(--radius-md);
		background-color: color-mix(in srgb, var(--color-bg-surface) 40%, transparent);
		padding: var(--spacing-3);
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		margin-bottom: var(--spacing-1);
	}

	.group-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		line-height: 1;
	}

	.branch-badge {
		font-size: 0.7rem;
		color: var(--color-text-muted);
		background-color: color-mix(in srgb, var(--color-border-subtle) 60%, transparent);
		border-radius: var(--radius-sm);
		padding: 1px 5px;
		line-height: 1.4;
	}

	.group-children {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}
</style>
