jest.mock('../../db/database', () => ({
  getDB: jest.fn()
}));

const gameRouter = require('../../routes/game');

function findRoute(path, method) {
  return gameRouter.stack.find(
    (layer) => layer.route && layer.route.path === path && layer.route.methods[method]
  );
}

describe('Boss Rush routes access', () => {
  test('POST /save-boss-rush-score is not developer-only', () => {
    const routeLayer = findRoute('/save-boss-rush-score', 'post');
    expect(routeLayer).toBeTruthy();
    expect(routeLayer.route.stack).toHaveLength(1);
    expect(routeLayer.route.stack.some((layer) => layer.name === 'requireDeveloper')).toBe(false);
  });

  test('GET /boss-rush-stats is not developer-only', () => {
    const routeLayer = findRoute('/boss-rush-stats', 'get');
    expect(routeLayer).toBeTruthy();
    expect(routeLayer.route.stack).toHaveLength(1);
    expect(routeLayer.route.stack.some((layer) => layer.name === 'requireDeveloper')).toBe(false);
  });
});
