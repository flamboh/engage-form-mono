<script lang="ts">
	import type { RequestEditor } from './editor.svelte';
	import PurposeField from './PurposeField.svelte';
	import ReceiptFacts from './ReceiptFacts.svelte';

	let { editor, recentPurposes }: { editor: RequestEditor; recentPurposes: string[] } = $props();
</script>

<div class="flex flex-col gap-8">
	<ReceiptFacts {editor} reading />

	<section class="flex flex-col gap-3" aria-labelledby="while-reading">
		<h2 id="while-reading" class="text-lg font-semibold text-(--ink)">
			While it reads: what’s it for?
		</h2>
		<PurposeField {editor} {recentPurposes} />
	</section>
</div>
