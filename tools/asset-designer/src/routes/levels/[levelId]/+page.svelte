<script lang="ts">
	import { onMount } from 'svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	type Position = { x: number; y: number };
	type Rectangle = { x: number; y: number; w: number; h: number };
	type MapCharacter = { id: string; position: Position; interactable: boolean; dialogueStart?: string };

	let levelData = $state(data.levelData);
	if (!levelData.collisions) levelData.collisions = [];
	if (!levelData.characters) levelData.characters = [];
	if (!levelData.scalingFactor) levelData.scalingFactor = 1;

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null = null;
	let bgImage: HTMLImageElement | null = null;

	const TILE_SIZE = 64;
	let scale = $state(1);
	let offsetX = $state(0);
	let offsetY = $state(0);

	let isDragging = false;
	let isDrawing = false;
	let startDragPos = { x: 0, y: 0 };
	let startDrawPixel = { x: 0, y: 0 };
	let currentDrawPixel = { x: 0, y: 0 };

	let tool = $state<'select' | 'player' | 'npc' | 'collision' | 'erase_collision'>('select');
	let selectedNpcId = $state(data.actors[0]?.id || '');
	let draggingEntity = $state<{ type: 'player' | 'npc'; index?: number } | null>(null);

	let saving = $state(false);

	onMount(() => {
		ctx = canvas.getContext('2d');
		bgImage = new Image();
		bgImage.src = `/api/assets/levels/${data.levelId}.webp`;
		bgImage.onload = () => {
			levelData.imageResolution = { width: bgImage!.naturalWidth, height: bgImage!.naturalHeight };
			// Center the map initially
			offsetX = (canvas.width - bgImage!.naturalWidth) / 2;
			offsetY = (canvas.height - bgImage!.naturalHeight) / 2;
			if (offsetX > 0) offsetX = 0;
			if (offsetY > 0) offsetY = 0;
			draw();
		};

		const resize = () => {
			if (!canvas) return;
			const parent = canvas.parentElement;
			if (parent) {
				canvas.width = parent.clientWidth;
				canvas.height = parent.clientHeight;
				draw();
			}
		};
		window.addEventListener('resize', resize);
		resize();

		return () => window.removeEventListener('resize', resize);
	});

	function draw() {
		if (!ctx || !canvas) return;
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		ctx.save();
		ctx.translate(offsetX, offsetY);
		ctx.scale(scale, scale);

		// 1. Draw Background
		if (bgImage) {
			ctx.drawImage(bgImage, 0, 0);
		}

		// 2. Draw Grid (Removed)
		const mapWidthPixels = levelData.imageResolution ? levelData.imageResolution.width : 2000;
		const mapHeightPixels = levelData.imageResolution ? levelData.imageResolution.height : 2000;

		// 3. Draw Collisions
		ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
		ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
		ctx.lineWidth = 2 / scale;
		for (const rect of levelData.collisions) {
			ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
			ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
		}

		// Draw current drawing collision
		if (isDrawing && tool === 'collision') {
			ctx.fillStyle = 'rgba(255, 100, 100, 0.5)';
			const rx = Math.min(startDrawPixel.x, currentDrawPixel.x);
			const ry = Math.min(startDrawPixel.y, currentDrawPixel.y);
			const rw = Math.abs(currentDrawPixel.x - startDrawPixel.x);
			const rh = Math.abs(currentDrawPixel.y - startDrawPixel.y);
			ctx.fillRect(rx, ry, rw, rh);
		}

		// 4. Draw Player Start
		ctx.fillStyle = 'rgba(0, 255, 0, 0.6)';
		ctx.beginPath();
		ctx.arc(
			levelData.playerStart.x,
			levelData.playerStart.y,
			TILE_SIZE / 3,
			0,
			Math.PI * 2
		);
		ctx.fill();
		ctx.fillStyle = '#111';
		ctx.font = `${16 / scale}px sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('P', levelData.playerStart.x, levelData.playerStart.y);

		// 5. Draw NPCs
		for (const npc of levelData.characters) {
			ctx.fillStyle = 'rgba(200, 200, 50, 0.6)';
			ctx.beginPath();
			ctx.arc(
				npc.position.x,
				npc.position.y,
				TILE_SIZE / 3,
				0,
				Math.PI * 2
			);
			ctx.fill();
			ctx.fillStyle = '#111';
			ctx.font = `${12 / scale}px sans-serif`;
			ctx.fillText(npc.id.substring(0, 3).toUpperCase(), npc.position.x, npc.position.y);
		}

		ctx.restore();
	}

	function getMousePos(e: MouseEvent) {
		const rect = canvas.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;
		const worldX = (mouseX - offsetX) / scale;
		const worldY = (mouseY - offsetY) / scale;
		const pixelX = Math.round(worldX);
		const pixelY = Math.round(worldY);
		return { mouseX, mouseY, worldX, worldY, pixelX, pixelY };
	}

	function handleMouseDown(e: MouseEvent) {
		const { mouseX, mouseY, worldX, worldY, pixelX, pixelY } = getMousePos(e);

		// Middle click or space+click for panning
		if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
			isDragging = true;
			startDragPos = { x: mouseX - offsetX, y: mouseY - offsetY };
			return;
		}

		if (e.button !== 0) return; // Only process left click

		if (tool === 'select') {
			// Check if clicking player
			const dx = pixelX - levelData.playerStart.x;
			const dy = pixelY - levelData.playerStart.y;
			if (dx * dx + dy * dy < 400) {
				draggingEntity = { type: 'player' };
			} else {
				// Check NPCs
				const npcIndex = levelData.characters.findIndex((c: MapCharacter) => {
					const nx = pixelX - c.position.x;
					const ny = pixelY - c.position.y;
					return nx * nx + ny * ny < 400;
				});
				if (npcIndex !== -1) {
					draggingEntity = { type: 'npc', index: npcIndex };
				}
			}
		} else if (tool === 'collision') {
			isDrawing = true;
			startDrawPixel = { x: worldX, y: worldY };
			currentDrawPixel = { x: worldX, y: worldY };
		} else if (tool === 'erase_collision') {
			// Remove clicked collision rects
			levelData.collisions = levelData.collisions.filter((rect: Rectangle) => {
				return !(worldX >= rect.x && worldX < rect.x + rect.w && worldY >= rect.y && worldY < rect.y + rect.h);
			});
			draw();
		} else if (tool === 'player') {
			levelData.playerStart = { x: pixelX, y: pixelY };
			draw();
		} else if (tool === 'npc') {
			levelData.characters.push({
				id: selectedNpcId,
				position: { x: pixelX, y: pixelY },
				interactable: true
			});
			levelData.characters = [...levelData.characters]; // trigger reactivity
			draw();
		}
	}

	function handleMouseMove(e: MouseEvent) {
		const { mouseX, mouseY, worldX, worldY, pixelX, pixelY } = getMousePos(e);

		if (isDragging) {
			offsetX = mouseX - startDragPos.x;
			offsetY = mouseY - startDragPos.y;
			draw();
		} else if (isDrawing && tool === 'collision') {
			currentDrawPixel = { x: worldX, y: worldY };
			draw();
		} else if (draggingEntity) {
			if (draggingEntity.type === 'player') {
				levelData.playerStart = { x: pixelX, y: pixelY };
			} else if (draggingEntity.type === 'npc' && draggingEntity.index !== undefined) {
				levelData.characters[draggingEntity.index].position = { x: pixelX, y: pixelY };
			}
			draw();
		}
	}

	function handleMouseUp(e: MouseEvent) {
		if (isDragging) {
			isDragging = false;
		}

		if (isDrawing && tool === 'collision') {
			isDrawing = false;
			const rx = Math.max(0, Math.min(startDrawPixel.x, currentDrawPixel.x));
			const ry = Math.max(0, Math.min(startDrawPixel.y, currentDrawPixel.y));
			const rw = Math.abs(currentDrawPixel.x - startDrawPixel.x);
			const rh = Math.abs(currentDrawPixel.y - startDrawPixel.y);

			// Only add if within map bounds
			const mapWidthPixels = levelData.imageResolution ? levelData.imageResolution.width : 2000;
			const mapHeightPixels = levelData.imageResolution ? levelData.imageResolution.height : 2000;

			if (rx < mapWidthPixels && ry < mapHeightPixels) {
				// Trim width/height to map bounds
				const actualW = Math.min(rw, mapWidthPixels - rx);
				const actualH = Math.min(rh, mapHeightPixels - ry);

				if (actualW > 0 && actualH > 0) {
					levelData.collisions.push({
						x: Math.round(rx),
						y: Math.round(ry),
						w: Math.round(actualW),
						h: Math.round(actualH)
					});
					levelData.collisions = [...levelData.collisions]; // trigger reactivity
				}
			}
			draw();
		}

		if (draggingEntity) {
			draggingEntity = null;
		}
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		const zoomSense = 0.001;
		scale -= e.deltaY * zoomSense;
		scale = Math.max(0.1, Math.min(scale, 5));
		draw();
	}

	async function saveLevel() {
		saving = true;
		try {
			const res = await fetch(`?/save`, {
				method: 'POST',
				body: new URLSearchParams({
					levelData: JSON.stringify(levelData)
				})
			});
			if (res.ok) {
				alert('Saved successfully');
			} else {
				alert('Failed to save');
			}
		} catch (err) {
			alert('Error saving level');
		} finally {
			saving = false;
		}
	}

	// Watch levelData.characters to update the table
	let npcList = $derived(levelData.characters);
</script>

<div class="h-[calc(100vh-80px)] w-full flex flex-col pt-2 bg-base-100/50">
	<div class="px-6 pb-2 pb-0 flex justify-between items-center shrink-0">
		<div>
			<h1 class="text-2xl font-bold">Editing: {data.levelId}</h1>
			{#if levelData.imageResolution}
			<p class="text-xs text-base-content/70">W: {levelData.imageResolution.width}px, H: {levelData.imageResolution.height}px</p>
			{/if}
		</div>
		<div class="flex gap-2">
			<a href="/levels" class="btn btn-ghost btn-sm">Back</a>
			<button class="btn btn-primary btn-sm" onclick={saveLevel} disabled={saving}>
				{#if saving}<span class="loading loading-spinner loading-xs"></span>{/if}
				Save JSON
			</button>
		</div>
	</div>

	<div class="flex-1 flex overflow-hidden">
		<!-- Tools Sidebar -->
		<div class="w-64 bg-base-200 p-4 flex flex-col gap-4 overflow-y-auto shrink-0 border-r border-base-300 shadow-inner">

			<div class="form-control">
				<label class="label"><span class="label-text font-bold">Scaling Factor</span></label>
				<input type="number" class="input input-sm input-bordered" bind:value={levelData.scalingFactor} step="0.5" min="0.5" />
			</div>

			<div class="divider my-0"></div>

			<div class="form-control">
				<label class="label"><span class="label-text font-bold">Tools</span></label>
				<button class="btn btn-sm btn-block justify-start mb-2" class:btn-active={tool === 'select'} onclick={() => tool = 'select'}>
					👆 Select/Move
				</button>
				<button class="btn btn-sm btn-block justify-start mb-2" class:btn-active={tool === 'player'} onclick={() => tool = 'player'}>
					🟢 Place Player Start
				</button>
				<button class="btn btn-sm btn-block justify-start mb-2" class:btn-active={tool === 'npc'} onclick={() => tool = 'npc'}>
					🟡 Place NPC
				</button>
				{#if tool === 'npc'}
					<select class="select select-sm select-bordered w-full mt-1 mb-2" bind:value={selectedNpcId}>
						{#each data.actors as actor}
							<option value={actor.id}>{actor.name}</option>
						{/each}
					</select>
				{/if}

				<div class="divider my-0"></div>
				<label class="label"><span class="label-text font-bold">Collisions</span></label>
				<button class="btn btn-sm btn-block justify-start mb-2" class:btn-active={tool === 'collision'} onclick={() => tool = 'collision'}>
					🟥 Draw Collision (Drag)
				</button>
				<button class="btn btn-sm btn-block justify-start" class:btn-active={tool === 'erase_collision'} onclick={() => tool = 'erase_collision'}>
					❌ Erase Collision
				</button>
			</div>

			<div class="divider my-0"></div>

			<div class="form-control">
				<label class="label"><span class="label-text font-bold">Entities placed</span></label>
				<div class="text-xs">
					<div class="flex justify-between p-1 bg-base-300 rounded mb-1">
						<span>Player Start</span>
						<span class="font-mono">({levelData.playerStart.x}, {levelData.playerStart.y})</span>
					</div>
					{#each npcList as npc, i}
						<div class="flex justify-between items-center p-1 bg-base-100 border border-base-300 rounded mb-1">
							<span class="truncate pr-2">{npc.id}</span>
							<div class="flex items-center gap-2 font-mono shrink-0">
								<span>({npc.position.x}, {npc.position.y})</span>
								<button class="btn btn-ghost btn-xs text-error p-0 h-auto min-h-0"
									onclick={() => {
										levelData.characters.splice(i, 1);
										levelData.characters = [...levelData.characters];
										draw();
									}}>×</button>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<div class="mt-auto pt-4 text-xs text-base-content/50">
				<p>• Middle click or Shift+drag to pan</p>
				<p>• Scroll wheel to zoom</p>
			</div>
		</div>

		<!-- Canvas Area -->
		<div class="flex-1 relative bg-base-300 overflow-hidden cursor-crosshair">
			<canvas
				bind:this={canvas}
				onmousedown={handleMouseDown}
				onmousemove={handleMouseMove}
				onmouseup={handleMouseUp}
				onmouseleave={handleMouseUp}
				onwheel={handleWheel}
				class="absolute inset-0 w-full h-full"
			></canvas>
		</div>
	</div>
</div>
