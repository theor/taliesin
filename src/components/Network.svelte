<script lang="ts">
	import type { INetwork } from "$lib";

    interface Props {
        network: INetwork;
    }
  const { network }: Props = $props();

    // const network = {
    //     id: '12345',
    //     status: 'active'
    // }; 
    
</script>
<div class="flex items-center gap-4">
    <p>{network.id}</p>
    <p class="chip preset-filled">{network.status}</p>
</div>