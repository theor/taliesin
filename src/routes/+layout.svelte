<script>
	// Finally, your application's global stylesheet (sometimes labeled 'app.css')
	import '../app.css';
</script>

<svelte:head>
	<title>Taliesin</title>

	<meta name="description" content="A Svelte-based music sequencer and synthesizer application." />
</svelte:head>

<div class="flex h-screen flex-col">
	<!-- <footer class=" h-10% p-4">(footer)</footer> -->
<slot></slot>
</div>
