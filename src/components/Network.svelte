<script lang="ts">
	import { store } from "$lib";


    // const network = {
    //     id: '12345',
    //     status: 'active'
    // }; 
    
</script>
<div class="flex items-center gap-4">
    <p>{store.id().substring(0,4)}</p>
    <p class="chip {store.host ? "preset-filled" : "preset-outlined"}">{store.host ? "host" : "joined"}</p>
    <!-- <p class="chip preset-filled">{store.status()}</p> -->

</div>