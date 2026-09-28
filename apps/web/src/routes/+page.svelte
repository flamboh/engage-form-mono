<script lang="ts">
	const receiptLines = [
		{ label: 'Paper plates 50ct', amount: '6.49' },
		{ label: 'Balloons 24ct', amount: '8.99' },
		{ label: 'Packing tape', amount: '3.50' }
	];

	const filled = [
		{ label: 'Vendor', value: 'Eugene Party Supply', from: 'receipt' },
		{ label: 'Total amount', value: '$18.98', from: 'receipt' },
		{ label: 'Purchase date', value: 'Oct 14, 2026', from: 'receipt' },
		{ label: 'Student organization', value: 'Album Listening Club', from: 'saved' },
		{ label: 'Budget line item', value: 'Event Expenses', from: 'saved' },
		{ label: 'Purchaser', value: 'You, with your UO ID on file', from: 'saved' }
	];

	const steps = [
		{
			title: 'Drop a receipt',
			body: 'A PDF from your email or a photo from your phone. We read the vendor, total, and date.'
		},
		{
			title: 'Say what it was for',
			body: 'Pick a saved reason or type one. Your name, club, and budget details are already filled in.'
		},
		{
			title: 'Press Fill on Engage',
			body: 'Engage opens and our Chrome extension types in every field and uploads your documents. You review and submit.'
		}
	];
</script>

<svelte:head>
	<title>Engage Form · Drop a receipt, we fill Engage</title>
	<meta
		name="description"
		content="For University of Oregon student organization officers: drop a receipt and Engage Form fills your Engage purchase request."
	/>
</svelte:head>

<div class="min-h-screen bg-white text-stone-900">
	<header class="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
		<span class="font-semibold tracking-tight text-[#154733]">Engage Form</span>
		<a class="text-sm font-medium text-stone-600 hover:text-stone-900" href="/app">Sign in</a>
	</header>

	<main>
		<section
			class="mx-auto grid max-w-5xl items-center gap-12 px-5 pt-8 pb-16 sm:px-8 md:grid-cols-[1.05fr_1fr] md:pt-16 md:pb-24"
		>
			<div class="flex flex-col gap-6">
				<h1 class="text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
					Drop a receipt.<br />We fill Engage.
				</h1>
				<p class="max-w-md text-lg text-stone-600">
					For UO student org officers getting paid back for club purchases. Skip retyping your
					receipt, your budget details, and your UO ID number into every purchase request.
				</p>
				<div class="flex flex-wrap items-center gap-3">
					<a
						class="inline-flex h-12 items-center rounded-full bg-[#154733] px-6 text-base font-medium text-white hover:bg-[#0f3526] focus-visible:ring-2 focus-visible:ring-[#154733]/40 focus-visible:ring-offset-2 focus-visible:outline-none"
						href="/app?auth=sign-up"
					>
						Get started
					</a>
					<a
						class="inline-flex h-12 items-center rounded-full px-5 text-base font-medium text-stone-700 hover:bg-stone-100"
						href="/app"
					>
						Sign in
					</a>
				</div>
			</div>

			<div class="relative mx-auto w-full max-w-md" aria-hidden="true">
				<div class="receipt w-[62%] -rotate-2 px-5 pt-5 pb-8 font-mono text-[11px] text-stone-700">
					<p class="text-center font-semibold tracking-wide text-stone-900">
						<mark class="hl hl-1">EUGENE PARTY SUPPLY</mark>
					</p>
					<p class="mt-1 text-center">
						<mark class="hl hl-3">10/14/2026</mark> 14:02
					</p>
					<div class="my-3 border-t border-dashed border-stone-300"></div>
					{#each receiptLines as line (line.label)}
						<p class="flex justify-between gap-2">
							<span>{line.label}</span><span>{line.amount}</span>
						</p>
					{/each}
					<div class="my-3 border-t border-dashed border-stone-300"></div>
					<p class="flex justify-between"><span>SUBTOTAL</span><span>18.98</span></p>
					<p class="flex justify-between"><span>TAX</span><span>0.00</span></p>
					<p class="mt-1 flex justify-between font-semibold text-stone-900">
						<span>TOTAL</span><mark class="hl hl-2">$18.98</mark>
					</p>
				</div>

				<div
					class="relative z-10 -mt-24 ml-auto w-[78%] border border-stone-200 bg-white p-4 shadow-[0_12px_40px_-12px_rgba(21,71,51,0.35)] sm:-mt-28"
				>
					<p class="mb-3 text-xs font-semibold text-[#154733]">Engage purchase request</p>
					<dl class="flex flex-col gap-2 text-[13px]">
						{#each filled as field, i (field.label)}
							<div
								class="field flex items-baseline justify-between gap-3 border-b border-stone-100 pb-1.5"
								style={`--delay: ${400 + i * 120}ms`}
							>
								<dt class="shrink-0 text-stone-500">{field.label}</dt>
								<dd
									class="truncate text-right font-medium {field.from === 'receipt'
										? 'rounded-sm bg-[#fee123]/70 px-1'
										: ''}"
								>
									{field.value}
								</dd>
							</div>
						{/each}
					</dl>
				</div>
			</div>
		</section>

		<section class="border-t border-stone-200 bg-[#f6f8f6]">
			<div class="mx-auto max-w-5xl px-5 py-14 sm:px-8 md:py-20">
				<h2 class="text-2xl font-semibold tracking-tight">Three steps from receipt to Engage</h2>
				<ol class="mt-8 grid gap-8 md:grid-cols-3">
					{#each steps as step, i (step.title)}
						<li class="flex flex-col gap-2">
							<span
								class="grid h-8 w-8 place-items-center rounded-full bg-[#154733] text-sm font-semibold text-white"
								>{i + 1}</span
							>
							<h3 class="mt-2 font-semibold">{step.title}</h3>
							<p class="text-sm leading-relaxed text-stone-600">{step.body}</p>
						</li>
					{/each}
				</ol>
				<p class="mt-12 max-w-2xl text-sm text-stone-500">
					You still review and submit every request on Engage yourself. Engage Form is a student
					project and isn't run by the University of Oregon or ASUO.
				</p>
			</div>
		</section>
	</main>
</div>

<style>
	.receipt {
		background: #fffef9;
		border: 1px solid #e7e5e4;
		border-bottom: none;
		mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / 10px 100%;
	}

	.hl {
		background: linear-gradient(#fee123, #fee123) no-repeat 0 60% / 0% 80%;
		color: inherit;
		padding: 0 2px;
		animation: sweep 500ms ease-out forwards;
	}

	.hl-1 {
		animation-delay: 300ms;
	}

	.hl-2 {
		animation-delay: 450ms;
	}

	.hl-3 {
		animation-delay: 600ms;
	}

	.field {
		opacity: 0;
		animation: appear 300ms ease-out forwards;
		animation-delay: var(--delay);
	}

	@keyframes sweep {
		to {
			background-size: 100% 80%;
		}
	}

	@keyframes appear {
		to {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hl,
		.field {
			animation: none;
			opacity: 1;
			background-size: 100% 80%;
		}
	}
</style>
