<script lang="ts">
	type PreviewFile = {
		name: string;
		type: string;
		url: string | null;
	};

	type Props = {
		label: string;
		status: string;
		multiple?: boolean;
		onFiles: (input: HTMLInputElement) => void | Promise<void>;
	};

	let { label, status, multiple = false, onFiles }: Props = $props();
	let input = $state<HTMLInputElement | null>(null);
	let files = $state<PreviewFile[]>([]);

	$effect(() => {
		const urls = files.flatMap((file) => (file.url === null ? [] : [file.url]));
		return () => {
			for (const url of urls) URL.revokeObjectURL(url);
		};
	});

	function selectFiles() {
		input?.click();
	}

	function onChange(event: Event) {
		const target = event.currentTarget;
		if (!(target instanceof HTMLInputElement)) return;
		files = Array.from(target.files ?? []).map((file) => ({
			name: file.name,
			type: file.type,
			url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
		}));
		void onFiles(target);
	}

	function fileKind(file: PreviewFile) {
		const extension = file.name.split('.').pop();
		return extension === undefined || extension === file.name ? 'file' : extension.toUpperCase();
	}
</script>

<div class="file-picker">
	<div class="file-head">
		<span>{label}</span>
		<button class="file-button" type="button" onclick={selectFiles}>Choose</button>
		<input bind:this={input} type="file" {multiple} onchange={onChange} />
	</div>

	{#if files.length > 0}
		<div class="file-grid">
			{#each files as file (file.name)}
				<div class="file-preview" title={file.name}>
					{#if file.url !== null}
						<img src={file.url} alt="" />
					{:else}
						<span>{fileKind(file)}</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<p>{status}</p>
</div>

<style>
	.file-picker {
		min-width: 0;
	}

	.file-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.file-head span {
		min-width: 0;
		overflow: hidden;
		font-weight: 500;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	input {
		display: none;
	}

	.file-button {
		min-height: 2.25rem;
		border-radius: 0.375rem;
		border: 1px solid rgb(214 211 209);
		padding: 0.35rem 0.65rem;
		background: white;
		font-size: 0.8125rem;
		font-weight: 500;
		transition-property: background-color, transform;
		transition-duration: 120ms;
	}

	.file-button:hover {
		background: rgb(250 250 249);
	}

	.file-button:active {
		transform: scale(0.96);
	}

	.file-grid {
		margin-top: 0.75rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.file-preview {
		display: grid;
		width: 2.75rem;
		height: 2.75rem;
		place-items: center;
		overflow: hidden;
		border-radius: 0.375rem;
		background: rgb(245 245 244);
		color: rgb(87 83 78);
		font-size: 0.625rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		outline: 1px solid rgb(0 0 0 / 8%);
	}

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	p {
		margin-top: 0.5rem;
		color: rgb(120 113 108);
		font-size: 0.75rem;
	}
</style>
