<script lang="ts">
	import Button from '$lib/ui/Button.svelte';

	let {
		busy = false,
		onsend
	}: {
		busy?: boolean;
		onsend: (note: string) => Promise<boolean>;
	} = $props();

	let dialog = $state<HTMLDialogElement | null>(null);
	let note = $state('');

	export function show() {
		note = '';
		dialog?.showModal();
	}

	async function send(event: SubmitEvent) {
		event.preventDefault();
		if (await onsend(note)) dialog?.close();
	}
</script>

<dialog
	bind:this={dialog}
	class="m-auto w-[min(32rem,calc(100vw-2rem))] border border-(--line) bg-(--surface) p-0 text-(--ink) backdrop:bg-black/30"
	aria-labelledby="sent-back-title"
>
	<form class="flex flex-col gap-4 p-5 sm:p-6" onsubmit={send}>
		<div class="flex flex-col gap-1">
			<h2 id="sent-back-title" class="text-lg font-semibold">Sent back by Engage</h2>
			<p class="text-sm text-(--quiet)">
				It reopens under To finish so you can fix it and fill it again.
			</p>
		</div>
		<label class="flex flex-col gap-1.5 text-sm">
			<span class="font-medium"
				>What did the reviewer say? <span class="font-normal text-(--quiet)">Optional</span></span
			>
			<textarea
				class="min-h-28 border border-(--line) bg-(--surface) px-3 py-2 text-base outline-none focus:border-(--pine)"
				placeholder="Add the event date to the Business Purpose"
				bind:value={note}
			></textarea>
		</label>
		<div class="flex justify-end gap-2">
			<Button variant="secondary" onclick={() => dialog?.close()}>Cancel</Button>
			<Button variant="primary" type="submit" {busy}>Reopen it</Button>
		</div>
	</form>
</dialog>
