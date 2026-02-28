<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import './styles.css';
	import { page } from '$app/stores';
	import NotificationsDropdown from '$lib/NotificationsDropdown.svelte';

	let { children } = $props();

	const navItems = [
		{ href: '/', label: 'Home' },
		{ href: '/actors', label: 'Actors' }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Asset Designer</title>
</svelte:head>

<div class="flex flex-col min-h-screen bg-base-200">
	<!-- Top Navigation -->
	<div class="navbar bg-base-100 shadow-sm px-4 sticky top-0 z-50">
		<div class="navbar-start">

			<a href="/" class="btn btn-ghost text-xl gap-2 font-bold normal-case">
				<span class="hidden sm:inline">Asset Designer</span>
			</a>
		</div>

		<div class="navbar-center hidden lg:flex">
			<ul class="menu menu-horizontal px-1 gap-2">
				{#each navItems as item}
					<li>
						<a
							href={item.href}
							class:text-primary={$page.url.pathname === item.href ||
								(item.href !== '/' && $page.url.pathname.startsWith(item.href))}
							class:font-bold={$page.url.pathname === item.href ||
								(item.href !== '/' && $page.url.pathname.startsWith(item.href))}
						>
							<span>{item.label}</span>
						</a>
					</li>
				{/each}
			</ul>
		</div>

		<div class="navbar-end gap-2">
			<!-- Mobile Navigation Dropdown -->
			<div class="dropdown dropdown-end lg:hidden">
				<button tabindex="0" class="btn btn-ghost btn-circle" aria-label="Open Menu">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" /></svg>
				</button>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<ul tabindex="0" class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
					{#each navItems as item}
						<li>
							<a
								href={item.href}
								class:text-primary={$page.url.pathname === item.href ||
									(item.href !== '/' && $page.url.pathname.startsWith(item.href))}
								class:font-bold={$page.url.pathname === item.href ||
									(item.href !== '/' && $page.url.pathname.startsWith(item.href))}
							>
								<span>{item.label}</span>
							</a>
						</li>
					{/each}
				</ul>
			</div>

			<NotificationsDropdown />
		</div>
	</div>

	<!-- Main Content -->
	<main class="flex-1 p-6">
		{@render children()}
	</main>
</div>
