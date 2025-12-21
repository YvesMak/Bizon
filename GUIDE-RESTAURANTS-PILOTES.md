# 🏪 GUIDE RESTAURANTS PILOTES - Programme Bizon MVP

**Bienvenue dans le programme pilote Bizon !**

Vous avez été sélectionné pour tester en avant-première notre solution de gestion de commandes et paiements Mobile Money.

---

## 🎯 POURQUOI PARTICIPER ?

### Avantages pour vous :

✅ **Gratuit pendant 3 mois** (valeur : 15 000 FCFA/mois)  
✅ **Support prioritaire dédié** (réponse < 1h)  
✅ **Formations illimitées** pour votre équipe  
✅ **Influence sur le produit** : vos suggestions façonnent Bizon V2  
✅ **Badge "Restaurant Pionnier"** sur votre profil  
✅ **Tarif préférentiel à vie** si vous continuez après le test  
✅ **Visibilité** : témoignage sur notre site (si vous acceptez)

### Ce qu'on attend de vous :

📌 **Utiliser Bizon quotidiennement** pendant minimum 15 jours  
📌 **Donner du feedback honnête** (positif ET négatif)  
📌 **Répondre aux questionnaires** (3 × 10 minutes max)  
📌 **Accepter 2-3 visites** de notre équipe sur place  
📌 **Être disponible** pour un entretien final (30 min)

---

## 📅 DÉROULEMENT DU PROGRAMME

### Phase 1️⃣ : Installation & Formation (Jour 1)
**Durée : 2-3 heures**

**Nous venons chez vous** pour :
1. Présenter Bizon en détail (15 min)
2. Créer votre compte restaurant (5 min)
3. Configurer votre menu (20-30 min)
4. Créer les comptes de votre équipe (10 min)
5. Former votre staff (30 min)
6. Tester en conditions réelles (30 min)

**Vous repartez avec** :
- ✅ Restaurant opérationnel sur Bizon
- ✅ Équipe formée et autonome
- ✅ Numéro WhatsApp support dédié
- ✅ Guide utilisateur PDF

### Phase 2️⃣ : Utilisation intensive (Jours 2-7)
**Durée : 1 semaine**

**Votre mission** :
- Utiliser Bizon pour **toutes vos commandes**
- Noter les bugs ou difficultés rencontrées
- Nous contacter dès qu'un problème survient

**Notre support** :
- 📱 WhatsApp : réponse < 1h (9h-20h)
- 🚨 Hotline urgence : disponible 24/7
- 🏪 Visite sur place si besoin critique

**Questionnaire rapide** en fin de semaine (10 min)

### Phase 3️⃣ : Validation & Stabilité (Jours 8-15)
**Durée : 1 semaine**

**Utilisation normale** :
- Vous êtes maintenant autonomes
- Support toujours disponible
- Nous observons la stabilité

**Entretien mi-parcours** (15 min) :
- Retour d'expérience
- Ajustements si nécessaire

### Phase 4️⃣ : Bilan & Décision (Jours 16-30)
**Durée : 2 semaines**

**Finalisation test** :
- Utilisation continue autonome
- Questionnaire final complet (20 min)
- Entretien de clôture (30 min)

**Votre décision** :
- ✅ Vous continuez avec tarif préférentiel ?
- ❌ Vous arrêtez (aucune obligation) ?

---

## 🛠️ FONCTIONNALITÉS DISPONIBLES (MVP)

### ✅ Ce que Bizon fait AUJOURD'HUI :

#### 📋 Gestion Menu
- Créer / modifier produits
- Organiser par catégories
- Gérer prix et stock
- Activer / désactiver produits

#### 🍽️ Prise de Commandes
- Commandes dine-in (sur place)
- Commandes takeaway (à emporter)
- Notes spéciales par produit
- Gestion numéros de table
- Historique complet

#### 💰 Paiements Mobile Money
- Orange Money
- Wave
- Free Money
- Vérification transaction manuelle
- Génération facture PDF automatique

#### 👥 Gestion Équipe
- 4 rôles : Owner, Manager, Serveur, Caissier
- Permissions différenciées
- Ajout/suppression utilisateurs

#### 📊 Statistiques
- Chiffre d'affaires journalier/hebdo/mensuel
- Nombre de commandes
- Ticket moyen
- Produits les plus vendus
- Méthodes de paiement

#### 🔐 Sécurité
- Isolation totale de vos données (multi-tenant)
- Mots de passe cryptés
- Tokens JWT sécurisés
- Logs d'audit

### ❌ Ce que Bizon NE fait PAS ENCORE (prévu V2) :

- ❌ Notifications temps réel (cuisine/caisse)
- ❌ Intégration API Mobile Money automatique
- ❌ Promotions / codes promo
- ❌ Programme fidélité clients
- ❌ Livraison à domicile
- ❌ Exports Excel / rapports comptables
- ❌ Réservations de tables
- ❌ CRM clients avancé

**💡 Vos suggestions détermineront la priorité V2 !**

---

## 🚀 ÉTAPES D'ONBOARDING (en détail)

### Étape 1 : Création compte (5 min)

Nous utilisons l'endpoint `/api/onboarding/quick-start` avec :
- Nom de votre restaurant
- Vos infos (gérant) : prénom, nom, email, téléphone, mot de passe
- Choix d'un template menu :
  - **Fast-Food** : Burgers, frites, boissons...
  - **Restaurant** : Plats traditionnels sénégalais
  - **Bar** : Cocktails, bières, snacks

**Résultat** : Compte créé + Menu pré-rempli en 5 secondes !

### Étape 2 : Personnalisation menu (15-30 min)

Nous ajustons ensemble le menu template :
- Renommer produits si nécessaire
- Modifier prix selon votre carte réelle
- Ajouter vos produits spécifiques
- Retirer ce que vous ne vendez pas
- Organiser catégories

**Résultat** : Menu 100% personnalisé prêt à utiliser.

### Étape 3 : Création comptes équipe (10 min)

Pour chaque membre de votre staff :
- Prénom, nom, téléphone
- Rôle : Serveur / Caissier / Manager
- Mot de passe (que vous définissez)

Nous leur envoyons leurs credentials par SMS/WhatsApp.

**Résultat** : Toute l'équipe peut se connecter immédiatement.

### Étape 4 : Formation équipe (30 min)

Nous formons votre équipe sur place :

**Pour les serveurs** (10 min) :
- Se connecter à la PWA
- Parcourir le menu
- Créer une commande
- Ajouter notes spéciales
- Envoyer à la cuisine

**Pour les caissiers** (10 min) :
- Consulter commandes prêtes
- Initier paiement Mobile Money
- Vérifier code transaction client
- Télécharger facture PDF

**Pour les cuisiniers** (5 min) :
- Consulter nouvelles commandes
- Changer statut (confirmed → preparing → ready)
- Lire notes spéciales

**Pour vous (gérant)** (5 min) :
- Consulter statistiques
- Gérer stock
- Ajouter/retirer utilisateurs
- Voir historique complet

### Étape 5 : Test en conditions réelles (30 min)

Nous restons sur place pendant un service pour :
- Observer l'utilisation réelle
- Répondre aux questions
- Corriger immédiatement les incompréhensions
- Vous rassurer sur les premières commandes

**Résultat** : Vous êtes autonomes et confiants !

---

## 📱 SUPPORT DISPONIBLE

### Canaux de contact :

#### 📲 WhatsApp Prioritaire
**Numéro** : +221 XX XXX XXXX (fourni à l'installation)  
**Horaires** : 9h-20h, 7j/7  
**Délai réponse** : < 1 heure  
**Usage** : Questions, bugs, conseils

#### 📧 Email
**Adresse** : support-pilote@bizon.app  
**Délai réponse** : < 4 heures (jours ouvrés)  
**Usage** : Questions non urgentes, suggestions

#### 🚨 Hotline Urgence
**Numéro** : +221 YY YYY YYYY (fourni à l'installation)  
**Horaires** : 24/7  
**Usage** : UNIQUEMENT bugs critiques bloquants (ex: impossible d'encaisser)

### Types de support :

✅ **Support technique** : bugs, erreurs, problèmes connexion  
✅ **Support fonctionnel** : comment faire telle action  
✅ **Formation continue** : nouvelles recrues à former  
✅ **Visite sur place** : si problème non résolvable à distance

### Engagement support :

| Gravité | Délai réponse | Délai résolution |
|---------|---------------|------------------|
| **Critique** (restaurant bloqué) | < 15 min | < 2 heures |
| **Majeur** (feature ne fonctionne pas) | < 1 heure | < 24 heures |
| **Mineur** (question, amélioration) | < 4 heures | Variable |

---

## 🐛 QUE FAIRE SI VOUS TROUVEZ UN BUG ?

### Étapes à suivre :

1. **Noter le contexte** :
   - Que faisiez-vous exactement ?
   - Quel utilisateur (rôle) ?
   - Quelle heure / situation (rush, calme) ?

2. **Prendre une capture d'écran** (si possible)

3. **Noter le message d'erreur** (si affiché)

4. **Nous contacter immédiatement** :
   - WhatsApp si urgent
   - Email si non bloquant

5. **Continuer à utiliser Bizon** :
   - Nous trouvons un workaround
   - Ou on corrige en urgence

### Ce que NOUS faisons :

✅ Accusé réception immédiat  
✅ Investigation immédiate  
✅ Correction en < 24h si critique  
✅ Test de la correction  
✅ Déploiement automatique  
✅ Confirmation résolution avec vous

**Vous ne perdez JAMAIS de temps avec un bug : on le règle POUR vous.**

---

## 💡 COMMENT DONNER DU BON FEEDBACK ?

### ✅ Feedback utile (exemples) :

> "Quand je crée une commande, j'aimerais voir le prix total avant de valider. Là je dois calculer dans ma tête."

> "Le bouton 'Paiement' n'est pas assez visible, je le cherche à chaque fois."

> "Les serveurs confondent 'Burger Classique' et 'Burger Complet', faudrait ajouter une description."

> "Le temps entre ma validation et la réception en cuisine est trop long (30-60 secondes), ça ralentit le service."

### ❌ Feedback peu utile (exemples) :

> "C'est nul." → Pourquoi ? Qu'est-ce qui ne va pas ?

> "Ça marche pas." → Qu'est-ce qui ne marche pas exactement ?

> "J'aime pas les couleurs." → C'est subjectif, on cherche des problèmes fonctionnels.

### 🎯 Les meilleurs feedbacks :

- **Spécifiques** : "Quand je fais X, il se passe Y, j'attendais Z"
- **Contextuels** : "Pendant le rush, cette fonctionnalité ralentit le service"
- **Constructifs** : "Ce serait mieux si on pouvait faire ça autrement : ..."
- **Priorisés** : "Pour moi, le plus important serait..."

---

## 📊 QUESTIONNAIRES À REMPLIR

### Questionnaire 1️⃣ : Post-onboarding (Jour 1)
**Durée : 5 minutes**  
**Focus** : Première impression, clarté installation

### Questionnaire 2️⃣ : Mi-parcours (Jour 7)
**Durée : 10 minutes**  
**Focus** : Utilisation quotidienne, bugs rencontrés, adoption équipe

### Questionnaire 3️⃣ : Final (Jour 15-30)
**Durée : 20 minutes**  
**Focus** : Satisfaction globale, ROI, décision continuation

**Tous les questionnaires sont dans le document GUIDE-FEEDBACK.md.**

---

## 🎁 COMPENSATION & RÉMUNÉRATION

### Gratuit pendant le test :

- ✅ **3 mois d'abonnement offerts** (valeur : 45 000 FCFA)
- ✅ **Support illimité gratuit**
- ✅ **Formations gratuites**
- ✅ **Aucun engagement après le test**

### Si vous continuez après le test :

- 🎉 **Tarif préférentiel à vie** : 10 000 FCFA/mois au lieu de 15 000 FCFA
- 🎉 **Badge "Restaurant Pionnier"** sur votre profil
- 🎉 **Priorité pour tester les features V2**

### Compensation en cas de perte due à un bug :

Si un bug Bizon vous fait perdre de l'argent (ex: commande perdue, double débit client), nous compensons à 100% après vérification.

---

## ❓ FAQ - QUESTIONS FRÉQUENTES

### Q1. Dois-je arrêter mon ancien système pendant le test ?

**Non, pas immédiatement.** Les 2-3 premiers jours, vous pouvez faire les deux en parallèle pour vous rassurer. Ensuite, on recommande de passer 100% sur Bizon pour vraiment le tester.

### Q2. Que se passe-t-il si mon équipe refuse d'utiliser Bizon ?

On vient former à nouveau, identifier les blocages, et trouver des solutions. L'adoption de l'équipe est critique pour nous, on vous accompagne.

### Q3. Mes données sont-elles sécurisées ?

Oui, 100%. Isolation totale de vos données (multi-tenant), cryptage des mots de passe, logs d'audit, backups quotidiens. Aucun autre restaurant ne peut voir vos données.

### Q4. Puis-je arrêter en cours de test ?

Oui, à tout moment, sans justification. On préfère un feedback honnête "ça ne me convient pas" qu'une utilisation forcée.

### Q5. Que se passe-t-il avec mes données si j'arrête ?

On vous envoie un export complet (Excel) et on supprime vos données sous 30 jours (RGPD).

### Q6. Dois-je avoir une connexion Internet 100% du temps ?

Oui, Bizon nécessite Internet. On recommande WiFi + forfait 4G de backup. La PWA peut fonctionner en mode dégradé hors-ligne (V2).

### Q7. Bizon fonctionne sur quels appareils ?

Smartphones (Android/iOS), tablettes, ordinateurs. C'est une PWA (Progressive Web App), ça marche sur tous les navigateurs modernes.

### Q8. Je dois payer les frais Mobile Money ?

Non, ce sont vos clients qui paient les frais de leur opérateur (Orange Money, Wave, etc.). Bizon ne prend aucune commission sur les paiements (MVP).

### Q9. Puis-je inviter d'autres restaurateurs après le test ?

Oui, programme de parrainage prévu avec avantages pour vous et votre filleul (détails à venir).

### Q10. Qui d'autre teste Bizon en ce moment ?

Pour l'instant, vous êtes parmi les 1-2 premiers restaurants pilotes. D'autres suivront selon les résultats de votre test.

---

## 📞 CONTACT PROGRAMME PILOTE

**Responsable programme** : [Nom Prénom]  
**Email** : pilotes@bizon.app  
**WhatsApp** : +221 XX XXX XXXX  
**Bureau** : Dakar, Sénégal

---

## ✅ CHECKLIST DE DÉMARRAGE

Avant de commencer votre test, assurez-vous que :

- [ ] Vous avez reçu la visite de notre équipe (Jour 1)
- [ ] Votre restaurant est créé et configuré
- [ ] Votre menu est personnalisé
- [ ] Toute votre équipe a ses identifiants
- [ ] Votre équipe est formée (30 min minimum)
- [ ] Vous avez testé au moins 1 commande complète (prise → paiement → facture)
- [ ] Vous avez le numéro WhatsApp support
- [ ] Vous avez le numéro hotline urgence
- [ ] Vous avez lu ce guide en entier
- [ ] Vous êtes prêt à donner du feedback honnête !

---

## 🙏 MERCI DE VOTRE CONFIANCE

En acceptant d'être restaurant pilote, vous nous aidez à construire le meilleur outil de gestion pour les restaurants sénégalais.

**Vos retours façonneront Bizon V2.**

Ensemble, modernisons la restauration au Sénégal ! 🇸🇳

---

**Document créé le 20 décembre 2025**  
**Programme Pilotes Bizon MVP**  
**Version 1.0**
