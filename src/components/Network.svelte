<script lang="ts">
	import { store } from "$lib";


    // const network = {
    //     id: '12345',
    //     status: 'active'
    // }; 
    
</script>
<div class="flex items-center gap-4">
    <p>{store.id()}</p>
    <p class="chip preset-filled">{store.status()}</p>

</div>