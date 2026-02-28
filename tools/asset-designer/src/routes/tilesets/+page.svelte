<script lang="ts">
	let { data } = $props();
</script>

<div class="max-w-7xl mx-auto">
	<div class="flex justify-between items-center mb-6">
		<h1 class="text-3xl font-bold">Tilesets</h1>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
		{#each data.tilesets as tileset}
			<a
				href="/tilesets/{tileset.id}"
				class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow border border-base-200"
			>
				<div class="card-body">
					<div class="flex justify-between items-start">
						<h2 class="card-title text-lg capitalize">
							{tileset.name}
						</h2>
						{#if tileset.hasImage}
							<div class="badge badge-success badge-sm" title="Image Generated">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 20 20"
									fill="currentColor"
									class="w-3 h-3"
								>
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
										clip-rule="evenodd"
									/>
								</svg>
							</div>
						{/if}
					</div>

					<p class="text-sm opacity-70 line-clamp-2 mt-2">
						{#if tileset.content}
							{tileset.content.split('\n')[0] || 'No description'}
						{:else}
							No description
						{/if}
					</p>

					<div class="card-actions justify-end mt-4">
						<span class="text-xs font-mono opacity-50">{tileset.id}</span>
					</div>
				</div>
			</a>
		{/each}

		{#if data.tilesets.length === 0}
			<div class="col-span-full">
				<div class="alert alert-info">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						class="stroke-current shrink-0 w-6 h-6"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						></path>
					</svg>
					<span
						>No tilesets found. Create markdown files in <code>docs/spec/tilesets/</code> to get
						started.</span
					>
				</div>
			</div>
		{/if}
	</div>
</div>
