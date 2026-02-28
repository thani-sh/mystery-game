<script lang="ts">
	import AnimatedFrame from '$lib/AnimatedFrame.svelte';
	import {
		generateConcept,
		generatePortrait,
		generateSpritesheet,
		generateMissingPortraits,
		generateMissingSpritesheets
	} from './generate.remote';
	import { jobsStore } from '$lib/stores/jobs.svelte';

	let { data } = $props();

	let generating = $state(false);
	let generatingPortraits = $state(false);
	let generatingSpritesheets = $state(false);
	let generatingExpression = $state<Record<string, boolean>>({});
	let generatingFrame = $state<Record<string, boolean>>({});
	let status = $state<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

	// Use $derived for values computed from props to avoid effect loops
	let conceptUrl = $derived(data.conceptDataUrl);
	let speechPortraits = $derived(
		Object.fromEntries(
			data.expressionTypes.map((type) => [type, data.speechPortraits[type]?.dataUrl || null])
		)
	);
	let frames = $derived(
		Object.fromEntries(data.animationTypes.map((type) => [type, data.animations[type]?.dataUrl || null]))
	);

	let missingPortraitsCount = $derived(
		data.expressionTypes.filter((type) => !data.speechPortraits[type]?.exists).length
	);
	let missingFramesCount = $derived(
		data.animationTypes.filter((type) => !data.animations[type]?.exists).length
	);

	// Check if idle spritesheet exists
	let hasIdleSpritesheet = $derived(data.animations['idle']?.exists || false);

	async function handleGenerateConcept() {
		generating = true;
		status = { type: 'info', message: 'Generating concept...' };
		const jobId = jobsStore.add(`Generating concept for ${data.actor.name}`);

		try {
			await generateConcept(data.actor.id);
			status = { type: 'success', message: 'Concept generated successfully!' };
			jobsStore.update(jobId, 'success', 'Concept generated successfully!');
			// Reload the page to get the new portrait
			window.location.reload();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Error generating concept';
			status = { type: 'error', message: errorMessage };
			jobsStore.update(jobId, 'error', errorMessage);
			console.error('Generate error:', error);
		} finally {
			generating = false;
		}
	}

	async function handleGenerateSpeechPortrait(expressionType: string) {
		generatingExpression[expressionType] = true;
		status = { type: 'info', message: `Generating ${expressionType} expression...` };
		const jobId = jobsStore.add(`Generating ${expressionType} expression for ${data.actor.name}`);

		try {
			await generatePortrait([data.actor.id, expressionType]);
			status = {
				type: 'success',
				message: `${expressionType} expression generated successfully!`
			};
			jobsStore.update(jobId, 'success', `${expressionType} expression generated successfully!`);
			// Reload the page to get the new portrait
			window.location.reload();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : `Error generating ${expressionType} expression`;
			status = {
				type: 'error',
				message: errorMessage
			};
			jobsStore.update(jobId, 'error', errorMessage);
			console.error('Generate error:', error);
		} finally {
			generatingExpression[expressionType] = false;
		}
	}

	async function handleGenerateFrame(frameType: string) {
		generatingFrame[frameType] = true;
		status = { type: 'info', message: `Generating ${frameType} frame...` };
		const jobId = jobsStore.add(`Generating ${frameType} frame for ${data.actor.name}`);

		try {
			await generateSpritesheet([data.actor.id, frameType]);
			status = { type: 'success', message: `${frameType} frame generated successfully!` };
			jobsStore.update(jobId, 'success', `${frameType} frame generated successfully!`);
			// Reload the page to get the new frame
			window.location.reload();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : `Error generating ${frameType} frame`;
			status = {
				type: 'error',
				message: errorMessage
			};
			jobsStore.update(jobId, 'error', errorMessage);
			console.error('Generate error:', error);
		} finally {
			generatingFrame[frameType] = false;
		}
	}

	async function handleGenerateMissingPortraits() {
		generatingPortraits = true;
		status = { type: 'info', message: `Generating ${missingPortraitsCount} missing portraits...` };
		const jobId = jobsStore.add(`Generating ${missingPortraitsCount} missing portraits for ${data.actor.name}`);

		try {
			const result = await generateMissingPortraits([data.actor.id, data.expressionTypes]);
			const successCount = result.results.filter((r) => r.success).length;
			const failCount = result.results.filter((r) => !r.success).length;

			if (failCount === 0) {
				status = { type: 'success', message: `Successfully generated all ${successCount} portraits!` };
				jobsStore.update(jobId, 'success', `Successfully generated all ${successCount} portraits!`);
			} else {
				status = { type: 'error', message: `Generated ${successCount} portraits, ${failCount} failed.` };
				jobsStore.update(jobId, 'error', `Generated ${successCount} portraits, ${failCount} failed.`);
			}
			setTimeout(() => window.location.reload(), 2000);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Error generating portraits';
			status = {
				type: 'error',
				message: errorMessage
			};
			jobsStore.update(jobId, 'error', errorMessage);
		} finally {
			generatingPortraits = false;
		}
	}

	async function handleGenerateMissingSpritesheets() {
		generatingSpritesheets = true;
		status = {
			type: 'info',
			message: `Generating ${missingFramesCount} missing spritesheets...`
		};
		const jobId = jobsStore.add(`Generating ${missingFramesCount} missing spritesheets for ${data.actor.name}`);

		try {
			// Filter animation types to ensure idle is generated first
			const orderedTypes = ['idle', ...data.animationTypes.filter((t) => t !== 'idle')];
			const result = await generateMissingSpritesheets([data.actor.id, orderedTypes]);
			const successCount = result.results.filter((r) => r.success).length;
			const failCount = result.results.filter((r) => !r.success).length;

			if (failCount === 0) {
				status = {
					type: 'success',
					message: `Successfully generated all ${successCount} spritesheets!`
				};
				jobsStore.update(jobId, 'success', `Successfully generated all ${successCount} spritesheets!`);
			} else {
				status = {
					type: 'error',
					message: `Generated ${successCount} spritesheets, ${failCount} failed.`
				};
				jobsStore.update(jobId, 'error', `Generated ${successCount} spritesheets, ${failCount} failed.`);
			}
			setTimeout(() => window.location.reload(), 2000);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Error generating spritesheets';
			status = {
				type: 'error',
				message: errorMessage
			};
			jobsStore.update(jobId, 'error', errorMessage);
		} finally {
			generatingSpritesheets = false;
		}
	}

</script>

<div class="max-w-7xl mx-auto">
	<h1 class="text-3xl font-bold mb-6">{data.actor.name}</h1>

	<div class="space-y-8">
		<!-- Concept Preview -->
		<div>
			<h2 class="text-xl font-bold mb-4">Concept Art</h2>

			<div class="bg-base-200 rounded-lg p-4 aspect-video flex items-center justify-center relative">
				{#if conceptUrl}
					<img src={conceptUrl} alt={data.actor.name} class="w-full h-full object-contain" />
				{:else}
					<div class="text-center text-base-content/50">
						<div class="text-6xl mb-4">👤</div>
						<p>No concept generated yet</p>
					</div>
				{/if}
				<button
					class="btn btn-circle btn-sm btn-primary absolute top-2 right-2"
					onclick={handleGenerateConcept}
					disabled={generating}
					title={generating ? 'Generating...' : conceptUrl ? 'Regenerate' : 'Generate'}
				>
					{#if generating}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
								clip-rule="evenodd"
							/>
						</svg>
					{/if}
				</button>
			</div>
		</div>

		<!-- Speech Portraits -->
		<div>
			<div class="flex justify-between items-end mb-4">
				<h2 class="text-xl font-bold">Speech Portraits</h2>
				{#if missingPortraitsCount > 0 && conceptUrl}
					<button
						class="btn btn-primary btn-sm"
						onclick={handleGenerateMissingPortraits}
						disabled={generatingPortraits}
					>
						{generatingPortraits ? 'Generating...' : `Generate Missing (${missingPortraitsCount})`}
					</button>
				{/if}
			</div>

			{#if !conceptUrl}
				<div class="alert alert-warning mb-4">
					<span class="text-sm">Generate a concept first to create speech portraits</span>
				</div>
			{/if}

			<!-- Multi-row grid container -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each data.expressionTypes as expressionType}
					<div>
						<h3 class="font-semibold mb-2 text-sm capitalize">
							{expressionType.replace(/-/g, ' ')}
						</h3>
						<div
							class="bg-base-200 rounded-lg p-4 aspect-square flex items-center justify-center relative"
						>
							{#if speechPortraits[expressionType]}
								<img
									src={speechPortraits[expressionType]}
									alt="{data.actor.name} - {expressionType}"
									class="w-full h-full object-contain"
								/>
							{:else}
								<div class="text-center text-base-content/50">
									<div class="text-4xl mb-2">😐</div>
									<p class="text-xs">No {expressionType} portrait yet</p>
								</div>
							{/if}
							<button
								class="btn btn-circle btn-sm btn-primary absolute top-2 right-2"
								onclick={() => handleGenerateSpeechPortrait(expressionType)}
								disabled={generatingExpression[expressionType] || !conceptUrl}
								title={generatingExpression[expressionType]
									? 'Generating...'
									: speechPortraits[expressionType]
										? 'Regenerate'
										: 'Generate'}
							>
								{#if generatingExpression[expressionType]}
									<span class="loading loading-spinner loading-xs"></span>
								{:else}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-4 w-4"
										viewBox="0 0 20 20"
										fill="currentColor"
									>
										<path
											fill-rule="evenodd"
											d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
											clip-rule="evenodd"
										/>
									</svg>
								{/if}
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Character Frames -->
		<div>
			<div class="flex justify-between items-end mb-4">
				<h2 class="text-xl font-bold">Character Frames</h2>
				{#if missingFramesCount > 0 && conceptUrl}
					<button
						class="btn btn-primary btn-sm"
						onclick={handleGenerateMissingSpritesheets}
						disabled={generatingSpritesheets}
					>
						{generatingSpritesheets ? 'Generating...' : `Generate Missing (${missingFramesCount})`}
					</button>
				{/if}
			</div>

			{#if !conceptUrl}
				<div class="alert alert-warning mb-4">
					<span class="text-sm">Generate a concept first to create character frames</span>
				</div>
			{/if}

			<div class="space-y-8">
				{#each data.animationTypes as animationType}
					<div class="bg-base-200/30 rounded-xl p-6 border border-base-200">
						<div class="flex justify-between items-center mb-6">
							<div>
								<h3 class="text-lg font-bold capitalize">{animationType} Animation</h3>
								<p class="text-sm text-base-content/60">Full 4x4 spritesheet for all directions</p>
								{#if animationType !== 'idle' && !hasIdleSpritesheet}
									<div class="badge badge-warning badge-sm mt-2">Requires idle spritesheet</div>
								{/if}
							</div>
							<button
								class="btn btn-circle btn-sm btn-primary"
								onclick={() => handleGenerateFrame(animationType)}
								disabled={generatingFrame[animationType] || !conceptUrl || (animationType !== 'idle' && !hasIdleSpritesheet)}
								title={generatingFrame[animationType]
									? 'Generating...'
									: animationType !== 'idle' && !hasIdleSpritesheet
										? 'Generate idle spritesheet first'
										: frames[animationType]
											? 'Regenerate Spritesheet'
											: 'Generate Spritesheet'}
							>
								{#if generatingFrame[animationType]}
									<span class="loading loading-spinner loading-xs"></span>
								{:else}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-4 w-4"
										viewBox="0 0 20 20"
										fill="currentColor"
									>
										<path
											fill-rule="evenodd"
											d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
											clip-rule="evenodd"
										/>
									</svg>
								{/if}
							</button>
						</div>

						<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
							{#each data.directions as direction, i}
								<div class="space-y-2">
									<div
										class="bg-base-300 rounded-lg p-3 aspect-square flex items-center justify-center relative shadow-sm"
									>
										{#if frames[animationType]}
											<AnimatedFrame
												src={frames[animationType] || ''}
												alt="{data.actor.name} - {animationType} {direction}"
												row={i}
											/>
										{:else}
											<div class="text-center text-base-content/30">
												<div class="text-2xl mb-1">
													{animationType === 'idle' ? '🧍' : '👣'}
												</div>
												<p class="text-[10px] uppercase font-bold tracking-wider">{direction}</p>
											</div>
										{/if}
									</div>
									<div class="text-center">
										<span class="text-[10px] uppercase font-bold text-base-content/50"
											>{direction}</span
										>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Status Messages -->
	{#if status}
		<div
			class="alert mt-6"
			class:alert-success={status.type === 'success'}
			class:alert-error={status.type === 'error'}
			class:alert-info={status.type === 'info'}
		>
			<span>{status.message}</span>
		</div>
	{/if}
</div>
