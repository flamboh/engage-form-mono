<script lang="ts">
	type Props = {
		title: string;
		subtitle: string;
		disclosure: string;
	};

	let { title, subtitle, disclosure }: Props = $props();
</script>

<header class="sticky top-0 z-10 border-b border-stone-200 bg-white">
	<div class="mx-auto max-w-5xl px-6 py-4">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="flex items-center gap-3">
				<a class="text-sm text-stone-500 hover:text-stone-900" href="/app/proto/purchase"
					>Prototypes</a
				>
				<h1 class="text-lg font-semibold">{title}</h1>
			</div>
			<span class="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
				Prototype · dummy data
			</span>
		</div>
		<p class="mt-1 text-sm text-stone-500">{subtitle}</p>
		<p class="mt-2 text-xs font-medium tracking-wide text-stone-400 uppercase">
			Progressive disclosure: {disclosure}
		</p>
	</div>
</header>
