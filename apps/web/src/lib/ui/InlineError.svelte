<script lang="ts">
	let { message, fix }: { message: string; fix?: { label: string; onclick: () => void } } =
		$props();
</script>

<p class="inline-error" role="alert">
	<span>{message}</span>
	{#if fix}<button type="button" onclick={fix.onclick}>{fix.label}</button>{/if}
</p>

<style>
	.inline-error {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 10px;
		margin: 0;
		font-size: 13.5px;
		color: var(--alert);
	}

	.inline-error::before {
		content: '';
		flex: none;
		width: 7px;
		height: 7px;
		align-self: center;
		background: var(--alert);
	}

	button {
		border: 0;
		background: none;
		padding: 0;
		font: inherit;
		font-weight: 550;
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}
</style>
