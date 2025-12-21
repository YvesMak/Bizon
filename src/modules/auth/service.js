const jwt = require('jsonwebtoken');
const { User, Restaurant, Subscription } = require('../../models');
const { sequelize } = require('../../config/database');

class AuthService {
  /**
   * Génère un token JWT
   */
  generateToken(userId, restaurantId, role) {
    return jwt.sign(
      { userId, restaurantId, role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }

  /**
   * Inscription : création restaurant + owner + subscription
   */
  async register(data) {
    const transaction = await sequelize.transaction();

    try {
      // Support deux formats : {name, email, ...} OU {restaurantName, firstName, lastName, ...}
      const restaurantName = data.name || data.restaurantName;
      const firstName = data.firstName || 'Owner';
      const lastName = data.lastName || '';
      const { email, password, phone, address } = data;

      // Vérifier si l'email existe déjà
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        throw new Error('Cet email est déjà utilisé');
      }

      // Créer le slug du restaurant
      const slug = restaurantName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Créer le restaurant
      const restaurant = await Restaurant.create({
        name: restaurantName,
        slug,
        email,
        phone,
        address
      }, { transaction });

      // Créer l'utilisateur owner
      const user = await User.create({
        restaurant_id: restaurant.id,
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        phone,
        role: 'owner',
        status: 'active'
      }, { transaction });

      // Créer la subscription trial (14 jours)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      await Subscription.create({
        restaurant_id: restaurant.id,
        plan: 'trial',
        status: 'active',
        start_date: new Date(),
        end_date: trialEndDate,
        max_users: 5,
        max_products: 100
      }, { transaction });

      await transaction.commit();

      // Générer le token
      const token = this.generateToken(user.id, restaurant.id, 'owner');

      // Retourner sans le mot de passe
      const userResponse = user.toJSON();
      delete userResponse.password;

      return {
        token,
        user: userResponse,
        restaurant: restaurant.toJSON()
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Connexion
   */
  async login(email, password) {
    const user = await User.findOne({
      where: { email },
      include: [{
        model: Restaurant,
        as: 'restaurant',
        attributes: ['id', 'name', 'slug', 'status']
      }]
    });

    if (!user) {
      throw new Error('Email ou mot de passe incorrect');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error('Email ou mot de passe incorrect');
    }

    if (user.status !== 'active') {
      throw new Error('Votre compte est inactif');
    }

    if (user.restaurant.status !== 'active') {
      throw new Error('Le restaurant est suspendu');
    }

    const token = this.generateToken(user.id, user.restaurant_id, user.role);

    const userResponse = user.toJSON();
    delete userResponse.password;

    return {
      token,
      user: userResponse
    };
  }

  /**
   * Récupérer le profil
   */
  async getProfile(userId) {
    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password'] },
      include: [{
        model: Restaurant,
        as: 'restaurant'
      }]
    });

    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    return user;
  }

  /**
   * Mise à jour du profil
   */
  async updateProfile(userId, data) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    const { first_name, last_name, phone } = data;
    await user.update({ first_name, last_name, phone });

    const updatedUser = user.toJSON();
    delete updatedUser.password;

    return updatedUser;
  }

  /**
   * Changement de mot de passe
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new Error('Mot de passe actuel incorrect');
    }

    if (newPassword.length < 6) {
      throw new Error('Le nouveau mot de passe doit contenir au moins 6 caractères');
    }

    await user.update({ password: newPassword });
    return true;
  }
}

module.exports = new AuthService();
