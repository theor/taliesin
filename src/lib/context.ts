import { getContext, setContext } from "svelte";

interface GlobalContext {
    host: boolean;
    debug: boolean;
    roomId: string;
    scaleKey: string;
    scaleMode: string;
}

const key = "globalContext";

export function setGlobalContext(ctx: GlobalContext) {
	setContext(key, ctx);
}

export function getGlobalContext() {
	return getContext(key) as GlobalContext;
}
