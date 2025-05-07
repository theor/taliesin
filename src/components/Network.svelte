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
<style>
    div {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
    }
</style>
<div>
    <p>Network ID: {network.id}</p>
    <p>Network Status: {network.status}</p>
</div>