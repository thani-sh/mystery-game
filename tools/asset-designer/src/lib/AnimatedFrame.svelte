<script lang="ts">
	interface Props {
		src: string;
		alt: string;
		row?: number; // 0: down, 1: left, 2: right, 3: up
		frameDelay?: number; // milliseconds per frame
	}

	let { src, alt, row = 0, frameDelay = 200 }: Props = $props();
</script>

<div
	class="w-full h-full overflow-hidden relative"
	style="image-rendering: pixelated; image-rendering: crisp-edges;"
>
	<img
		{src}
		{alt}
		class="absolute top-0 max-w-none h-[400%] animate-sprite-walk"
		style="
			width: 400%;
			top: calc({row} * -100%);
			animation-duration: {frameDelay * 4}ms;
		"
	/>
</div>

<style>
	.animate-sprite-walk {
		animation: playX steps(4) infinite;
	}

	@keyframes playX {
		from {
			left: 0;
		}
		to {
			left: -400%;
		}
	}
</style>
