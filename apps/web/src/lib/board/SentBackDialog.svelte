<script lang="ts">
	import Button from '$lib/ui/Button.svelte';

	let {
		vendor,
		busy = false,
		onconfirm,
		oncancel
	}: {
		vendor: string;
		busy?: boolean;
		onconfirm: (note: string) => void;
		oncancel: () => void;
	} = $props();

	const uid = $props.id();
	let note = $state('');

	function open(dialog: HTMLDialogElement) {
		dialog.showModal();
		return () => dialog.close();
	}
</script>

<dialog
	class="m-auto w-[min(28rem,calc(100%-2rem))] border border-ink bg-surface p-0 text-ink backdrop:bg-ink/40"
	aria-labelledby="{uid}-title"
	{@attach open}
	oncancel={(event) => {
		event.preventDefault();
		oncancel();
	}}
>
	<form
		class="flex flex-col gap-4 p-5"
		onsubmit={(event) => {
			event.preventDefault();
			onconfirm(note);
		}}
	>
		<div class="flex flex-col gap-1">
			<h2 id="{uid}-title" class="text-[17px] font-[620]">{vendor} was sent back</h2>
			<p class="text-sm text-quiet">
				It moves back to To finish. Fix what the reviewer asked for, then fill it again.
			</p>
		</div>
		<label class="flex flex-col gap-1.5 text-sm font-medium" for="{uid}-note">
			What did the reviewer say?
			<span class="font-normal text-quiet"
				>Optional. It shows on the request until you fill it again.</span
			>
		</label>
		<textarea
			id="{uid}-note"
			class="min-h-24 border border-line bg-surface px-3 py-2 text-base focus:border-pine focus:outline-none sm:text-sm"
			bind:value={note}
		></textarea>
		<div class="flex items-center justify-end gap-4">
			<Button variant="quiet" disabled={busy} onclick={oncancel}>Cancel</Button>
			<Button variant="primary" type="submit" {busy}>Move to To finish</Button>
		</div>
	</form>
</dialog>
