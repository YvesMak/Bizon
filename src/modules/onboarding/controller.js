const OnboardingService = require('./service');

class OnboardingController {
  /**
   * Création rapide d'un restaurant complet (endpoint public)
   */
  async quickStart(req, res) {
    try {
      const result = await OnboardingService.quickStart(req.body);
      
      res.status(201).json({
        message: 'Restaurant créé avec succès ! Vous pouvez maintenant vous connecter.',
        data: result
      });
    } catch (error) {
      console.error('Erreur onboarding quick-start:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Récupérer les templates de menus disponibles
   */
  async getTemplates(req, res) {
    try {
      const templates = await OnboardingService.getTemplates();
      
      res.json({ templates });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new OnboardingController();
