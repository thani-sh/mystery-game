<script lang="ts">
	import { generateTilesetImageCommand } from './generate.remote';
	import { marked } from 'marked';

	let { data } = $props();

	let generating = $state(false);
	let status = $state<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

	let imageUrl = $derived(data.imageUrl);

	async function handleGenerateTileset() {
		generating = true;
		status = { type: 'info', message: 'Generating tileset...' };

		try {
			await generateTilesetImageCommand(data.tileset.id);
			status = { type: 'success', message: 'Tileset generated successfully!' };
			// Reload the page to get the new image
			window.location.reload();
		} catch (error) {
			status = { type: 'error', message: error instanceof Error ? error.message : 'Error generating tileset' };
			console.error('Generate error:', error);
		} finally {
			generating = false;
		}
	}
</script>

<div class="max-w-7xl mx-auto">
	<div class="flex items-center gap-4 mb-6">
		<a href="/tilesets" class="btn btn-circle btn-ghost btn-sm" aria-label="Back to tilesets">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
		</a>
		<h1 class="text-3xl font-bold capitalize">{data.tileset.name}</h1>
	</div>

	<div class="grid grid-cols-1 gap-8">
		<!-- Generation Preview -->
		<div class="space-y-6">
			<div class="flex justify-between items-end">
				<div>
					<h2 class="text-xl font-bold">16x16 Tileset Output</h2>
					<p class="text-sm opacity-70">Generates 256 tiles packed into a 16x16 grid image</p>
				</div>
				<button
					class="btn btn-primary btn-sm"
					onclick={handleGenerateTileset}
					disabled={generating}
				>
					{generating ? 'Generating...' : imageUrl ? 'Regenerate' : 'Generate'}
				</button>
			</div>

			<div class="bg-base-200 rounded-lg p-4 aspect-square flex items-center justify-center relative shadow-inner overflow-hidden">
				{#if imageUrl}
					<img src={imageUrl} alt={data.tileset.name} class="w-full h-full object-contain [image-rendering:pixelated]" />
				{:else}
					<div class="text-center text-base-content/50">
						<div class="text-6xl mb-4 text-center">🗺️</div>
						<p>No tileset generated yet</p>
					</div>
				{/if}
			</div>

			<!-- Status Messages -->
			{#if status}
				<div
					class="alert"
					class:alert-success={status.type === 'success'}
					class:alert-error={status.type === 'error'}
					class:alert-info={status.type === 'info'}
				>
					<span>{status.message}</span>
				</div>
			{/if}
		</div>
	</div>
</div>
