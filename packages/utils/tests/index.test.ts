import { expect, test } from 'vitest';
import { fn } from '../src/index.ts';

test('fn', () => {
	expect(fn()).toBe('Hello, tsdown!');
});
