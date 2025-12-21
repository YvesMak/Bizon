const AuthService = require('./service');

class AuthController {
  /**
   * Inscription d'un nouveau restaurant et utilisateur owner
   */
  async register(req, res) {
    try {
      const result = await AuthService.register(req.body);
      res.status(201).json({
        message: 'Inscription réussie',
        ...result
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Connexion utilisateur
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      res.json(result);
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  }

  /**
   * Obtenir le profil de l'utilisateur connecté
   */
  async getProfile(req, res) {
    try {
      const user = await AuthService.getProfile(req.user.id);
      res.json(user);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  /**
   * Mise à jour du profil
   */
  async updateProfile(req, res) {
    try {
      const user = await AuthService.updateProfile(req.user.id, req.body);
      res.json({
        message: 'Profil mis à jour',
        user
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Changement de mot de passe
   */
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      await AuthService.changePassword(req.user.id, currentPassword, newPassword);
      res.json({ message: 'Mot de passe modifié avec succès' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new AuthController();
