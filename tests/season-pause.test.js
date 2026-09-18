'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '../public/js/season_pass.js'), 'utf8');
function setup(now) {
  const toggle = jest.fn();
  const label = { textContent: 'Fino al 5 Ott' };
  const context = {
    Date: class extends Date { static now() { return now; } },
    window: {}, setTimeout: jest.fn(), clearTimeout: jest.fn(),
    document: {
      getElementById: () => ({ classList: { toggle } }),
      querySelector: () => label
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, toggle, label };
}
const end = '2026-10-05T23:59:59Z';
test('hides announcement during the season and schedules the deadline', () => {
  const { context, toggle } = setup(Date.parse(end) - 1000);
  context.updateSeasonPauseNotice({ season_end: end, active: true });
  expect(toggle).toHaveBeenCalledWith('hidden', true);
  expect(context.setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
});
test('shows announcement at the deadline, including an already open menu', () => {
  const { context, toggle, label } = setup(Date.parse(end));
  context.updateSeasonPauseNotice({ season_end: end, active: true });
  expect(toggle).toHaveBeenCalledWith('hidden', false);
  expect(label.textContent).toBe('Stagione terminata');
  expect(context.setTimeout).not.toHaveBeenCalled();
});
test('honors the server when the client clock is behind', () => {
  const { context, toggle } = setup(Date.parse(end) - 1000);
  context.updateSeasonPauseNotice({ season_end: end, active: false });
  expect(toggle).toHaveBeenCalledWith('hidden', false);
});
test('does not announce a pause without a valid season end', () => {
  const { context, toggle } = setup(0);
  context.updateSeasonPauseNotice({});
  expect(toggle).not.toHaveBeenCalled();
});
