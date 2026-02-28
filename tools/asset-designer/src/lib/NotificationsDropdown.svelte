<script lang="ts">
	import { jobsStore } from '$lib/stores/jobs.svelte';
	import { slide } from 'svelte/transition';

	// Helper to format timestamp
	function formatTime(ms: number) {
		return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
</script>

<div class="dropdown dropdown-end">
	<div tabindex="0" role="button" class="btn btn-ghost btn-circle">
		<div class="indicator">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
				/>
			</svg>
			{#if jobsStore.activeJobsCount > 0}
				<span class="badge badge-sm badge-primary indicator-item">
					{jobsStore.activeJobsCount}
				</span>
			{:else if jobsStore.jobs.length > 0}
				<span class="badge badge-sm badge-ghost indicator-item border-base-300">
					{jobsStore.jobs.length}
				</span>
			{/if}
		</div>
	</div>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		tabindex="0"
		class="mt-3 z-[1] card card-compact dropdown-content w-80 bg-base-100 shadow-xl border border-base-200"
	>
		<div class="card-body">
			<div class="flex justify-between items-center mb-2">
				<h3 class="font-bold text-lg">Jobs</h3>
				{#if jobsStore.jobs.length > 0}
					<button
						class="btn btn-xs btn-ghost text-base-content/60"
						onclick={() => jobsStore.clearPast()}
					>
						Clear History
					</button>
				{/if}
			</div>

			{#if jobsStore.jobs.length === 0}
				<div class="p-4 text-center text-sm text-base-content/60">
					No recent jobs
				</div>
			{:else}
				<ul class="space-y-2 max-h-96 overflow-y-auto pr-1 flex flex-col gap-2">
					{#each jobsStore.jobs as job (job.id)}
						<li transition:slide|local>
							<div class="flex items-start gap-3 p-3 bg-base-200 rounded-lg">
								<div class="mt-0.5">
									{#if job.status === 'running'}
										<span class="loading loading-spinner loading-xs text-primary"></span>
									{:else if job.status === 'success'}
										<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-success" viewBox="0 0 20 20" fill="currentColor">
											<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
										</svg>
									{:else}
										<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-error" viewBox="0 0 20 20" fill="currentColor">
											<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
										</svg>
									{/if}
								</div>
								<div class="flex-1 min-w-0">
									<p class="text-sm font-medium truncate" class:text-base-content={job.status !== 'error'} class:text-error={job.status === 'error'}>
										{job.title}
									</p>
									{#if job.message}
										<p class="text-xs text-base-content/60 mt-1 line-clamp-2">{job.message}</p>
									{/if}
									<p class="text-[10px] text-base-content/40 mt-1">{formatTime(job.createdAt)}</p>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>
