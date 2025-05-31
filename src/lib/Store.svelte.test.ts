import { flushSync } from 'svelte';
import { expect, test } from 'vitest';
import { makePartData, store } from './Store.svelte.js';
import { PartSteps } from './parts.svelte.js';
import { PianoScale } from './instruments/MonoSynth.js';

test('Multiplier', () => {
	let p = makePartData(PartSteps);
  const i = store.createInstrument(PianoScale);

	const ser = i;
  expect(ser).toBeDefined();
  console.log(ser);
  const i2 = ser;//store.deserializeInstrumentData(ser);
  expect(i2).toBeDefined();
  expect(i2.name).toBe('PianoScale');
  expect(i2.parts.length).toBe(i.parts.length);
});
 