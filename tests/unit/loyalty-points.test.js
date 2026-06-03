const loyalty = require('../../src/modules/loyalty/service');

describe('LoyaltyService.pointsForAmount', () => {
  it('attribue 1 point par tranche de 100 FCFA', () => {
    expect(loyalty.pointsForAmount(100)).toBe(1);
    expect(loyalty.pointsForAmount(2360)).toBe(23);
    expect(loyalty.pointsForAmount(99)).toBe(0);
    expect(loyalty.pointsForAmount(0)).toBe(0);
  });

  it('tronque vers le bas', () => {
    expect(loyalty.pointsForAmount(199)).toBe(1);
    expect(loyalty.pointsForAmount(250)).toBe(2);
  });

  it('gère les valeurs nulles/invalides', () => {
    expect(loyalty.pointsForAmount(null)).toBe(0);
    expect(loyalty.pointsForAmount(undefined)).toBe(0);
  });
});
