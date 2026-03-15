<script lang="ts">
	let { data } = $props();
</script>

<div class="max-w-4xl mx-auto space-y-6">
	<div class="flex justify-between items-end">
		<div>
			<h1 class="text-3xl font-bold">Levels</h1>
			<p class="text-base-content/70 mt-2">Manage your level assets, collisions, and entity placement here.</p>
		</div>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
		{#each data.levels as level}
			<a href="/levels/{level}" class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all cursor-pointer">
				<figure class="aspect-video bg-base-300 relative overflow-hidden group">
					<img src="/api/assets/levels/{level}.webp" alt={level} class="object-cover w-full h-full" />
					<div class="absolute inset-0 bg-base-300/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
						<span class="btn btn-primary">Edit Level</span>
					</div>
				</figure>
				<div class="card-body">
					<h2 class="card-title capitalize font-bold text-center w-full block">
						{level.replace(/-/g, ' ')}
					</h2>
				</div>
			</a>
		{:else}
			<div class="col-span-full py-12 text-center text-base-content/50">
				<p>No levels found. Add image files to the assets/levels directory.</p>
			</div>
		{/each}
	</div>
</div>
