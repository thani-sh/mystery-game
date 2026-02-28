<script lang="ts">
	import { page } from '$app/stores';

	let { data, children } = $props();
</script>

<div class="flex min-h-[calc(100vh-4rem)]">
	<!-- Left Sidebar -->
	<aside class="w-64 border-r border-base-200 bg-base-100 flex-shrink-0">
		<div class="p-4 border-b border-base-200 sticky top-0 bg-base-100 z-10 flex justify-between items-center">
			<h2 class="font-bold text-lg">Actors</h2>
		</div>
		<ul class="menu w-full p-2 gap-1">
			{#each data.actors as actor}
				<li>
					<a
						href="/actors/{actor.id}"
						class:bg-base-200={$page.params.actorId === actor.id}
						class:text-primary={$page.params.actorId === actor.id}
						class:font-medium={$page.params.actorId === actor.id}
					>
						<div class="flex items-center gap-3">
							<div class="w-6 h-6 rounded-full bg-base-300 flex items-center justify-center overflow-hidden shrink-0">
								{#if actor.conceptDataUrl}
									<img src={actor.conceptDataUrl} alt={actor.name} class="w-full h-full object-cover" />
								{:else}
									<span class="text-xs">👤</span>
								{/if}
							</div>
							<span class="truncate">{actor.name}</span>
						</div>
					</a>
				</li>
			{/each}
			{#if data.actors.length === 0}
				<li class="p-2 text-sm text-base-content/50 text-center">No actors found</li>
			{/if}
		</ul>
	</aside>

	<!-- Main Content Area -->
	<div class="flex-1 w-full">
		<div class="p-6">
			{@render children()}
		</div>
	</div>
</div>
