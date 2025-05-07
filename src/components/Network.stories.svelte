<script module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import Network from './Network.svelte';
    import { fn } from '@storybook/test';
	import { Status, TestNetwork } from '$lib';
  
    // More on how to set up stories at: https://storybook.js.org/docs/writing-stories
    const { Story } = defineMeta({
      title: 'Example/Network',
      component: Network,
      // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
      tags: ['autodocs'],
      parameters: {
        // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
        layout: 'fullscreen',
      },
      args: {
        network: {status: 'connected', id:'storyn'},
      }
    });
  </script>
  
  <Story name="Logged In" args={{network: new TestNetwork(Status.connected) }} />
  
  <Story name="Logged Out" args={{network: new TestNetwork() }}  />
  