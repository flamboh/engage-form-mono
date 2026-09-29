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

<div class="min-h-screen bg-surface text-ink">
	<header class="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
		<span class="font-semibold tracking-tight text-pine">Engage Form</span>
		<a class="text-sm font-medium text-quiet hover:text-ink" href="/app">Sign in</a>
	</header>

	<main>
		<section
			class="mx-auto grid max-w-5xl items-center gap-12 px-5 pt-8 pb-16 sm:px-8 md:grid-cols-[1.05fr_1fr] md:pt-16 md:pb-24"
		>
			<div class="flex flex-col gap-6">
				<h1 class="text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
					Drop a receipt.<br />We fill Engage.
				</h1>
				<p class="max-w-md text-lg text-quiet">
					For UO student org officers getting paid back for club purchases. Skip retyping your
					receipt, your budget details, and your UO ID number into every purchase request.
				</p>
				<div class="flex flex-wrap items-center gap-3">
					<a
						class="inline-flex h-12 items-center bg-pine px-6 text-base font-semibold text-white hover:bg-pine-deep"
						href="/app?auth=sign-up"
					>
						Get started
					</a>
					<a
						class="inline-flex h-12 items-center border border-ink px-5 text-base font-semibold text-ink hover:bg-ink hover:text-white"
						href="/app"
					>
						Sign in
					</a>
				</div>
			</div>

			<div class="relative mx-auto w-full max-w-md" aria-hidden="true">
				<div class="receipt-frame w-[64%] -rotate-2">
					<div class="receipt px-5 pt-5 pb-8 font-mono text-[11px] text-quiet">
						<p class="text-center font-semibold tracking-wide text-ink">
							<mark class="hl hl-1">EUGENE PARTY SUPPLY</mark>
						</p>
						<p class="mt-1 text-center">
							<mark class="hl hl-3">10/14/2026</mark> 14:02
						</p>
						<div class="my-3 border-t border-dashed border-line"></div>
						{#each receiptLines as line (line.label)}
							<p class="flex justify-between gap-2">
								<span>{line.label}</span><span>{line.amount}</span>
							</p>
						{/each}
						<div class="my-3 border-t border-dashed border-line"></div>
						<p class="flex justify-between"><span>SUBTOTAL</span><span>18.98</span></p>
						<p class="flex justify-between"><span>TAX</span><span>0.00</span></p>
						<p class="mt-1 flex justify-between font-semibold text-ink">
							<span>TOTAL</span><mark class="hl hl-2">$18.98</mark>
						</p>
					</div>
				</div>

				<div
					class="relative z-10 -mt-6 ml-auto w-[92%] border border-line bg-surface p-4 shadow-[0_12px_40px_-12px_rgba(21,71,51,0.35)] sm:w-[80%]"
				>
					<p class="mb-3 text-xs font-semibold text-pine">Engage purchase request</p>
					<dl class="flex flex-col gap-2 text-[13px]">
						{#each filled as field, i (field.label)}
							<div
								class="filled-row flex items-baseline justify-between gap-3 border-b border-line pb-1.5"
								style={`--delay: ${400 + i * 120}ms`}
							>
								<dt class="shrink-0 text-quiet">{field.label}</dt>
								<dd
									class="truncate text-right font-medium {field.from === 'receipt'
										? 'bg-marker/70 px-1'
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

		<section class="border-t border-line bg-paper">
			<div class="mx-auto max-w-5xl px-5 py-14 sm:px-8 md:py-20">
				<h2 class="text-2xl font-semibold tracking-tight">Three steps from receipt to Engage</h2>
				<ol class="mt-8 grid gap-8 md:grid-cols-3">
					{#each steps as step, i (step.title)}
						<li class="flex flex-col gap-2">
							<span class="grid h-8 w-8 place-items-center bg-marker text-sm font-semibold text-ink"
								>{i + 1}</span
							>
							<h3 class="mt-2 font-semibold">{step.title}</h3>
							<p class="text-sm leading-relaxed text-quiet">{step.body}</p>
						</li>
					{/each}
				</ol>
				<p class="mt-12 max-w-2xl text-sm text-quiet">
					You still review and submit every request on Engage yourself. Engage Form is a student
					project and isn't run by the University of Oregon or ASUO.
				</p>
			</div>
		</section>
	</main>
</div>

<style>
	.receipt-frame {
		filter: drop-shadow(0 0 1px rgb(120 113 108 / 0.7)) drop-shadow(0 4px 6px rgb(0 0 0 / 0.06));
	}

	.receipt {
		background: #fffef9;
		mask:
			linear-gradient(#000 0 0) top / 100% calc(100% - 8px) no-repeat,
			conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom / 16px 8px
				repeat-x;
	}

	.hl {
		background: linear-gradient(var(--marker), var(--marker)) no-repeat 0 60% / 0% 80%;
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

	.filled-row {
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
		.filled-row {
			animation: none;
			opacity: 1;
			background-size: 100% 80%;
		}
	}
</style>
