<script lang="ts">
	let { message, fix }: { message: string; fix?: { label: string; onclick: () => void } } =
		$props();
</script>

<div class="banner" role="alert">
	<p>{message}</p>
	{#if fix}<button type="button" onclick={fix.onclick}>{fix.label}</button>{/if}
</div>

<style>
	.banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
		border: 1px solid var(--alert);
		border-left-width: 3px;
		background: var(--alert-soft);
		padding: 12px 16px;
	}

	p {
		margin: 0;
		flex: 1;
		min-width: 12rem;
		font-size: 14.5px;
		line-height: 1.5;
		color: var(--ink);
	}

	button {
		border: 0;
		background: none;
		padding: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--alert);
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}
</style>
