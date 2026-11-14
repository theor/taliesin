import { fetchIceServers } from '$lib/turn';
import type { PageLoad } from './$types';

// Short-lived TURN credentials are fetched before the room is joined (`?turn=` overrides, for testing).
export const load: PageLoad = async ({ fetch, url }) => ({
  iceServers: await fetchIceServers(
    url.searchParams.get('turn') ?? import.meta.env.VITE_TURN_ENDPOINT,
    fetch
  )
});
