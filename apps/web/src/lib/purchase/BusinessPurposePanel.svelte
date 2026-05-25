<script lang="ts">
	type Props = {
		businessPurposeText: string;
		businessPurposeTemplateId: string | null;
		businessPurposeTouched: boolean;
		templateText: string;
		onInput: () => void;
		onRegenerate: () => void;
	};

	let {
		businessPurposeText = $bindable(),
		businessPurposeTemplateId = $bindable(),
		businessPurposeTouched = $bindable(),
		templateText,
		onInput,
		onRegenerate
	}: Props = $props();
</script>

<section class="panel">
	<h2>Business Purpose</h2>
	<textarea
		class="field min-h-36"
		bind:value={businessPurposeText}
		oninput={() => {
			businessPurposeTemplateId = null;
			businessPurposeTouched = true;
			onInput();
		}}
	></textarea>
	<button
		class="secondary mt-3"
		type="button"
		onclick={() => {
			businessPurposeTemplateId = null;
			businessPurposeText = templateText;
			businessPurposeTouched = false;
			onRegenerate();
		}}
	>
		Regenerate
	</button>
</section>

<style>
	.panel {
		border: 1px solid rgb(231 229 228);
		border-radius: 0.5rem;
		background: white;
		padding: 1.25rem;
	}

	.field {
		width: 100%;
		border-radius: 0.375rem;
		border: 1px solid rgb(214 211 209);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
	}

	.secondary {
		border-radius: 0.375rem;
		border: 1px solid rgb(214 211 209);
		padding: 0.45rem 0.7rem;
		font-size: 0.8125rem;
		font-weight: 500;
	}
</style>
