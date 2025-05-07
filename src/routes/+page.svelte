<script lang="ts">
     import { AppBar } from '@skeletonlabs/skeleton-svelte';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import Paperclip from '@lucide/svelte/icons/paperclip';
  import Calendar from '@lucide/svelte/icons/calendar';
  import CircleUser from '@lucide/svelte/icons/circle-user';
  import Menu from '@lucide/svelte/icons/menu';



	import { network } from '$lib';
	import '../main.scss';
	import Network from '../components/Network.svelte';
	import Transport from '../components/Transport.svelte';
	console.log(network.id + ' ' + network.status);
</script>
<AppBar headlineClasses="sm:hidden" centerClasses="hidden sm:block">
    {#snippet lead()}
      <ArrowLeft size={24} />
    {/snippet}
    {#snippet trail()}
      <div class="hidden space-x-4 sm:flex">
        <Transport/>
      </div>
      <div class="block sm:hidden">
        <Menu size={20} />
      </div>
    {/snippet}
    {#snippet headline()}
      <h2 class="h2">Title</h2>
    {/snippet}
    <span>Title</span>
  </AppBar>
<div class="h-screen grid grid-rows-[auto_1fr_auto]">
   
	<!-- Header -->
	<header class="flex items-center gap-8 p-4">
		<Network {network} />
        <Transport />
	</header>
	<!-- Main -->
	<main class=" p-4 space-y-4">
		<p class="h-[512px] p-4">Paragraph 1</p>
		<p class="h-[512px] p-4">Paragraph 2</p>
		<p class="h-[512px] p-4">Paragraph 3</p>
	</main>
	<!-- Footer -->
	<footer class=" p-4">(footer)</footer>
</div>

<!-- <main class="container">
	<header>
		<Network network={network} />
	</header>
	<h1>Welcome to SvelteKit</h1>
	<p>
		Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation
	</p>
</main> -->
