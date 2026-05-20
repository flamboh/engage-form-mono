<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$convex/_generated/api';
	import { useConvexClient } from 'convex-svelte';

	type Fund = 'I' | 'E' | 'G' | 'N' | 'U' | 'D' | 'T';

	const client = useConvexClient();

	const defaultTemplate =
		'{org} wishes to reimburse {purchaser} because they purchased {item} from {vendor} for {amount}. This {item} was given to {recipient} ({recipientUo95}) during {eventName} which took place on {eventDate} at {eventTime} in {eventLocation} with about {attendance} students in attendance.';

	let name = $state('');
	let indexNumber = $state('');
	let fundLetter = $state<Fund>('I');
	let budgetLines = $state<string[]>(['Event Expenses']);
	let businessPurposeTemplate = $state(defaultTemplate);
	let saving = $state(false);
	let error = $state('');

	function addBudgetLine() {
		budgetLines = [...budgetLines, ''];
	}

	function removeBudgetLine(i: number) {
		budgetLines = budgetLines.filter((_, index) => index !== i);
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		saving = true;
		try {
			await client.mutation(api.authed.purchaseBuilder.upsertOrganization, {
				id: null,
				name,
				indexNumber,
				fundLetter,
				budgetLines,
				businessPurposeTemplate
			});
			await goto('/app/welcome/event');
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			saving = false;
		}
	}
</script>

<form class="space-y-5" onsubmit={save}>
	<header>
		<h2 class="text-lg font-semibold">Your Student Organization</h2>
		<p class="mt-1 text-sm text-stone-500">
			You can add more student organizations later from the Saved page.
		</p>
	</header>

	{#if error}
		<p class="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
	{/if}

	<label class="block text-sm">
		<span class="font-medium">Student organization name</span>
		<input class="field mt-1" required bind:value={name} />
	</label>

	<label class="block text-sm">
		<span class="font-medium">Index number</span>
		<input class="field mt-1" required bind:value={indexNumber} />
	</label>

	<label class="block text-sm">
		<span class="font-medium">Fund letter</span>
		<select class="field mt-1" bind:value={fundLetter}>
			<option>I</option><option>E</option><option>G</option><option>N</option><option>U</option
			><option>D</option><option>T</option>
		</select>
	</label>

	<div class="text-sm">
		<span class="font-medium">Budget Line Items</span>
		<p class="text-xs text-stone-500">Match the labels in your Engage budget exactly.</p>
		<div class="mt-2 space-y-2">
			{#each budgetLines as _line, i (i)}
				<div class="flex items-center gap-2">
					<input class="field flex-1" required bind:value={budgetLines[i]} />
					{#if budgetLines.length > 1}
						<button class="secondary" type="button" onclick={() => removeBudgetLine(i)}
							>Remove</button
						>
					{/if}
				</div>
			{/each}
		</div>
		<button class="secondary mt-2" type="button" onclick={addBudgetLine}>Add line</button>
	</div>

	<label class="block text-sm">
		<span class="font-medium">Business purpose template</span>
		<p class="text-xs text-stone-500">
			Tokens like {`{org}`} and {`{vendor}`} fill in automatically per request.
		</p>
		<textarea class="field mt-1 min-h-32" bind:value={businessPurposeTemplate}></textarea>
	</label>

	<button class="button" type="submit" disabled={saving}>
		{saving ? 'Saving...' : 'Continue'}
	</button>
</form>

<style>
	.field {
		width: 100%;
		border-radius: 0.375rem;
		border: 1px solid rgb(214 211 209);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
	}
	.button {
		border-radius: 0.375rem;
		background: rgb(28 25 23);
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: white;
	}
	.button:disabled {
		opacity: 0.6;
	}
	.secondary {
		border-radius: 0.375rem;
		border: 1px solid rgb(214 211 209);
		padding: 0.4rem 0.7rem;
		font-size: 0.8125rem;
		font-weight: 500;
	}
</style>
