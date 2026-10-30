import { expect, it } from 'vitest';
import { laesRute, tilHash } from './navigation';

it('læser og skriver adresser', () => {
  expect(laesRute('')).toBeNull();
  expect(laesRute('#/start')).toEqual({ side: 'start' });
  expect(laesRute('#/klasse/abc/elever')).toEqual({ side: 'klasse', id: 'abc', fane: 'elever' });
  expect(laesRute('#/klasse/abc/ukendt')).toEqual({ side: 'klasse', id: 'abc', fane: null });
  expect(tilHash({ side: 'klasse', id: 'a b', fane: 'plan' })).toBe('#/klasse/a%20b/plan');
  expect(laesRute(tilHash({ side: 'data' }))).toEqual({ side: 'data' });
});
