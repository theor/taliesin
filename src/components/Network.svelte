<script lang="ts">
	import { store } from "$lib";
    import { RouterIcon } from "@lucide/svelte";


    // const network = {
    //     id: '12345',
    //     status: 'active'
    // }; 
    
</script>
<div class="flex items-center gap-4">
    <p></p>
    <p class="chip {store.host ? "preset-filled" : "preset-outlined"}">
        {#if store.host} <RouterIcon size=16/>{/if}
        {store.id().substring(0,4)}
    </p>
    <!-- <p class="chip preset-filled">{store.status()}</p> -->

</div>
