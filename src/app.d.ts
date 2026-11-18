// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    /** Shallow-routing state: the page shown, so Back and Forward move between pages (`lib/nav.svelte.ts`). */
    interface PageState {
      nav?: import('$lib/nav.svelte').NavState;
    }
    // interface Platform {}
  }
}

export {};
