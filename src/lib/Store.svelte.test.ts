import { flushSync } from 'svelte';
import { expect, test } from 'vitest';
import { store } from './Store.svelte.js';
import { PartSteps } from './parts.svelte.js';
import { PianoScale } from './instruments/MonoSynth.js';

test('Multiplier', () => {
	let p = new PartSteps(1,2,true);
  const i = store.createInstrument(PianoScale);

	const ser = store.serializeInstrumentData(i);
  expect(ser).toBeDefined();
  console.log(ser);
  const i2 = store.deserializeInstrumentData(ser);
  expect(i2).toBeDefined();
  expect(i2.name).toBe('PianoScale');
  expect(i2.parts.length).toBe(i.parts.length);
});
 