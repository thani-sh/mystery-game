<script lang="ts">
	import { generateMissingConcepts } from './generate-batch.remote';
	import { jobsStore } from '$lib/stores/jobs.svelte';

	let { data } = $props();
	let generating = $state(false);
	let status = $state<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

	// Count actors missing concepts
	let missingConceptsCount = $derived(data.actors.filter((a) => !a.hasConcept).length);

	async function handleGenerateMissing() {
		generating = true;
		status = { type: 'info', message: `Generating concepts for ${missingConceptsCount} actors...` };
		const jobId = jobsStore.add(`Generating concepts for ${missingConceptsCount} actors...`);

		try {
			const result = await generateMissingConcepts();
			const successCount = result.results.filter((r) => r.success).length;
			const failCount = result.results.filter((r) => !r.success).length;

			if (failCount === 0) {
				status = {
					type: 'success',
					message: `Successfully generated ${successCount} concept images!`
				};
				jobsStore.update(jobId, 'success', `Successfully generated ${successCount} concept images!`);
			} else {
				status = {
					type: 'error',
					message: `Generated ${successCount} concepts, ${failCount} failed.`
				};
				jobsStore.update(jobId, 'error', `Generated ${successCount} concepts, ${failCount} failed.`);
			}

			// Reload page to show new concepts
			setTimeout(() => window.location.reload(), 2000);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to generate concepts';
			status = {
				type: 'error',
				message: errorMessage
			};
			jobsStore.update(jobId, 'error', errorMessage);
		} finally {
			generating = false;
		}
	}
</script>

<div class="max-w-7xl mx-auto">
	<div class="flex justify-end items-center mb-6">
		{#if missingConceptsCount > 0}
			<button
				class="btn btn-primary"
				onclick={handleGenerateMissing}
				disabled={generating}
			>
				{generating
					? 'Generating...'
					: `Generate Missing Concepts (${missingConceptsCount})`}
			</button>
		{/if}
	</div>

	{#if status}
		<div
			class="alert mb-6"
			class:alert-success={status.type === 'success'}
			class:alert-error={status.type === 'error'}
			class:alert-info={status.type === 'info'}
		>
			<span>{status.message}</span>
		</div>
	{/if}

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
		{#each data.actors as actor}
			<a
				href="/actors/{actor.id}"
				class="block bg-base-100 border border-base-300 hover:border-primary transition-colors"
			>
				<div class="bg-base-200 aspect-square flex items-center justify-center overflow-hidden">
					{#if actor.conceptDataUrl}
						<img src={actor.conceptDataUrl} alt={actor.name} class="w-full h-full object-cover" />
					{:else}
						<div class="text-6xl">👤</div>
					{/if}
				</div>
				<div class="p-4">
					<h2 class="text-xl font-bold">{actor.name}</h2>
				</div>
			</a>
		{/each}
	</div>

	{#if data.actors.length === 0}
		<div class="alert">
			<span>No actors found. Add actor markdown files to docs/spec/actors/</span>
		</div>
	{/if}
</div>
