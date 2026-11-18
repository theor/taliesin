/** `E2E_APP_PORT` moves the test's dev server off 5199 when that port is busy. */
export const APP_PORT = Number(process.env.E2E_APP_PORT ?? 5199);
export const RELAY_PORT = 4869;
export const APP_URL = `http://localhost:${APP_PORT}`;
export const RELAY_URL = `ws://localhost:${RELAY_PORT}`;
