<script lang="ts">
	import ExtensionStatus from '$lib/extension/ExtensionStatus.svelte';
	import Button from '$lib/ui/Button.svelte';
</script>

<ol class="steps">
	<li>
		<span class="n">1</span>
		<div class="flex flex-col gap-2">
			<b>Add the extension to Chrome</b>
			<span class="text-quiet">It isn’t in the Chrome Web Store yet, so it installs by hand.</span>
			<div>
				<Button variant="primary" href="/engage-form-extension.zip" download>
					Download the extension
				</Button>
			</div>
			<ol class="list-decimal pl-4 text-quiet marker:text-faint">
				<li>Unzip the download into a folder you’ll keep.</li>
				<li>
					Open <code class="bg-paper px-1">chrome://extensions</code> and turn on Developer mode.
				</li>
				<li>Choose Load unpacked and pick the unzipped folder.</li>
			</ol>
		</div>
	</li>
	<li>
		<span class="n">2</span>
		<div class="flex flex-col gap-2">
			<b>Connect it to this account</b>
			<ExtensionStatus />
		</div>
	</li>
	<li>
		<span class="n">3</span>
		<div class="flex flex-col gap-1">
			<b>Press Fill on Engage</b>
			<span class="text-quiet">
				When a request is ready, Engage opens and the extension fills the form. You review it and
				submit.
			</span>
		</div>
	</li>
</ol>

<style>
	.steps {
		display: flex;
		flex-direction: column;
		gap: 20px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 14.5px;
		line-height: 1.5;
	}

	.steps > li {
		display: flex;
		gap: 16px;
	}

	.n {
		display: grid;
		flex: none;
		width: 28px;
		height: 28px;
		place-items: center;
		background: var(--marker);
		font-size: 13px;
		font-weight: 650;
	}

	b {
		font-weight: 600;
	}
</style>
