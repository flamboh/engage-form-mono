import { expect, test } from 'vitest';
import { fn } from './index.ts';

test('fn', () => {
	expect(fn()).toBe('Hello, tsdown!');
});
