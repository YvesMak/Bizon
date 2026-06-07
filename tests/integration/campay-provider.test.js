const campay = require('../../src/modules/payments/providers/campay');

describe('Campay — normalisation du numéro', () => {
  it('met les numéros camerounais au format 2376XXXXXXXX', () => {
    expect(campay._normalizePhone('690000000')).toBe('237690000000');
    expect(campay._normalizePhone('0690000000')).toBe('237690000000');
    expect(campay._normalizePhone('+237 690 00 00 00')).toBe('237690000000');
    expect(campay._normalizePhone('237690000000')).toBe('237690000000');
    expect(campay._normalizePhone('00237690000000')).toBe('237690000000');
  });
});
