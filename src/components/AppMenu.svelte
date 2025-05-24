<script lang="ts">
    const { drawerClose }: {
        drawerClose?: () => void;
    } = $props();
</script>
<header class="flex justify-between">
    <h2 class="h2">Drawer Example</h2>
</header>
<article>
    <p class="opacity-60">
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Nam, ab adipisci. Libero
        cumque sunt quis error veritatis amet, expedita voluptatem. Quos repudiandae
        consequuntur voluptatem et dicta quas, reprehenderit velit excepturi?
    </p>
</article>
<footer>
    {#if drawerClose}
    <button type="button" class="btn preset-filled" onclick={drawerClose}
        >Close Drawer</button
    >
    {/if}
</footer>
