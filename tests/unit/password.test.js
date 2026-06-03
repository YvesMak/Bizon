const bcrypt = require('bcryptjs');
const { User, Customer } = require('../../src/models');

describe('Hachage des mots de passe (modèles)', () => {
  describe('User', () => {
    it('hache le mot de passe à la création (jamais en clair)', async () => {
      const { createRestaurant } = require('../helpers/factory');
      const resto = await createRestaurant();
      const user = await User.create({
        restaurant_id: resto.id,
        email: 'hash-user@test.cm',
        password: 'secret123',
        first_name: 'A',
        last_name: 'B',
        role: 'owner'
      });
      expect(user.password).not.toBe('secret123');
      expect(user.password.startsWith('$2')).toBe(true);
    });

    it('comparePassword renvoie true pour le bon mot de passe, false sinon', async () => {
      const { createRestaurant } = require('../helpers/factory');
      const resto = await createRestaurant();
      const user = await User.create({
        restaurant_id: resto.id,
        email: 'cmp-user@test.cm',
        password: 'secret123',
        first_name: 'A',
        last_name: 'B',
        role: 'owner'
      });
      await expect(user.comparePassword('secret123')).resolves.toBe(true);
      await expect(user.comparePassword('mauvais')).resolves.toBe(false);
    });
  });

  describe('Customer', () => {
    it('hache password_hash à la création', async () => {
      const { createRestaurant } = require('../helpers/factory');
      const resto = await createRestaurant();
      const customer = await Customer.create({
        restaurant_id: resto.id,
        first_name: 'Awa',
        last_name: 'C',
        phone: '+237690111222',
        password_hash: 'clientpass'
      });
      expect(customer.password_hash).not.toBe('clientpass');
      expect(customer.password_hash.startsWith('$2')).toBe(true);
    });

    it('comparePassword fonctionne avec un hash connu (sans DB)', async () => {
      const hash = await bcrypt.hash('abc123', 10);
      const customer = Customer.build({ password_hash: hash });
      await expect(customer.comparePassword('abc123')).resolves.toBe(true);
      await expect(customer.comparePassword('xxx')).resolves.toBe(false);
    });

    it('comparePassword renvoie false si aucun mot de passe défini', async () => {
      const customer = Customer.build({ password_hash: null });
      await expect(customer.comparePassword('quoiquecesoit')).resolves.toBe(false);
    });
  });
});
