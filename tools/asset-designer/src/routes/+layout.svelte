<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import './styles.css';
	import { page } from '$app/stores';

	let { children } = $props();

	const navItems = [
		{ href: '/', label: 'Home', icon: '🏠' },
		{ href: '/actors', label: 'Actors', icon: '👥' },
		{ href: '/tilesets', label: 'Tilesets', icon: '🗺️' }
	];

	// Generate breadcrumbs from current path
	let breadcrumbs = $derived(() => {
		const path = $page.url.pathname;
		const segments = path.split('/').filter(Boolean);

		const crumbs = [{ label: 'Home', href: '/' }];

		let currentPath = '';
		for (const segment of segments) {
			currentPath += `/${segment}`;
			const navItem = navItems.find((item) => item.href === currentPath);
			crumbs.push({
				label: navItem?.label || segment.charAt(0).toUpperCase() + segment.slice(1),
				href: currentPath
			});
		}

		return crumbs;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Asset Designer</title>
</svelte:head>

<div class="drawer lg:drawer-open">
	<input id="main-drawer" type="checkbox" class="drawer-toggle" />

	<div class="drawer-content flex flex-col bg-base-200">
		<!-- Breadcrumbs -->
		<div class="bg-base-100 px-6 py-3 shadow-sm">
			<div class="breadcrumbs text-sm">
				<ul>
					{#each breadcrumbs() as crumb, i}
						<li>
							{#if i === breadcrumbs().length - 1}
								<span class="font-semibold">{crumb.label}</span>
							{:else}
								<a href={crumb.href} class="link link-hover">{crumb.label}</a>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		</div>

		<!-- Main Content -->
		<main class="flex-1 p-6">
			{@render children()}
		</main>

		<!-- Mobile Menu Button -->
		<label
			for="main-drawer"
			class="btn btn-primary drawer-button lg:hidden fixed bottom-4 right-4 btn-circle"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				class="inline-block w-6 h-6 stroke-current"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 6h16M4 12h16M4 18h16"
				></path>
			</svg>
		</label>
	</div>

	<div class="drawer-side">
		<label for="main-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
		<aside class="bg-base-100 min-h-full w-64 p-4 flex flex-col">
			<!-- Sidebar Header -->
			<div class="mb-8">
				<a href="/" class="flex items-center gap-2 px-2">
					<span class="text-2xl">🎨</span>
					<span class="text-xl font-bold">Asset Designer</span>
				</a>
			</div>

			<!-- Navigation Menu -->
			<ul class="menu flex-1 gap-2">
				{#each navItems as item}
					<li>
						<a
							href={item.href}
							class:active={$page.url.pathname === item.href ||
								(item.href !== '/' && $page.url.pathname.startsWith(item.href))}
						>
							<span class="text-xl">{item.icon}</span>
							<span>{item.label}</span>
						</a>
					</li>
				{/each}
			</ul>

			<!-- Sidebar Footer -->
			<div class="mt-auto pt-4 border-t border-base-300">
				<p class="text-xs text-center opacity-60">Mystery Game Asset Designer</p>
			</div>
		</aside>
	</div>
</div>
