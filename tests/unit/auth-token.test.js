const jwt = require('jsonwebtoken');
const authService = require('../../src/modules/auth/service');
const customerService = require('../../src/modules/customers/service');

describe('Génération de tokens JWT', () => {
  it('AuthService.generateToken encode userId, restaurantId et role', () => {
    const token = authService.generateToken('user-1', 'resto-1', 'owner');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.userId).toBe('user-1');
    expect(decoded.restaurantId).toBe('resto-1');
    expect(decoded.role).toBe('owner');
    expect(decoded.exp).toBeGreaterThan(decoded.iat);
  });

  it('CustomerService.generateToken encode customerId et role=customer', () => {
    const token = customerService.generateToken('cust-1', 'resto-1');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.customerId).toBe('cust-1');
    expect(decoded.restaurantId).toBe('resto-1');
    expect(decoded.role).toBe('customer');
  });

  it('rejette un token signé avec un mauvais secret', () => {
    const token = authService.generateToken('u', 'r', 'owner');
    expect(() => jwt.verify(token, 'mauvais_secret')).toThrow();
  });
});
