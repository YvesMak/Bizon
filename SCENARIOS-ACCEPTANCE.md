# 🎯 SCÉNARIOS D'ACCEPTANCE - Tests Terrain Bizon

## Objectif

Valider que Bizon fonctionne dans des conditions réelles d'utilisation au restaurant.

---

## SCÉNARIO 1 : Service midi complet

### Contexte
Restaurant avec 10 tables, service de midi entre 12h et 15h, pic d'affluence vers 13h.

### Acteurs
- 2 serveurs (Abdou, Mariama)
- 1 caissier (Aminata)
- 1 gérant (Fatou)

### Déroulement

**12h15 - Première commande**
```
✅ Serveur Abdou se connecte
✅ Crée commande Table 3 : 
   - 2x Yassa Poulet
   - 1x Thiéboudienne
   - 3x Bissap
✅ Commande envoyée (statut: pending)
✅ Ticket cuisine imprimé (si imprimante configurée)
```

**12h30 - Commande prête**
```
✅ Gérant Fatou change statut → preparing
✅ Gérant Fatou change statut → ready
✅ Serveur Abdou notifié (si notifications actives)
```

**12h45 - Paiement client**
```
✅ Caissier Aminata récupère commande Table 3
✅ Crée paiement Mobile Money Orange Money
✅ Client effectue paiement sur son téléphone
✅ Client donne code transaction : OM987654321
✅ Caissier vérifie le paiement
✅ Facture PDF générée automatiquement
✅ Commande passée à completed
```

**13h00 - Pic d'affluence**
```
✅ Serveur Abdou : 3 commandes simultanées (Tables 5, 7, 9)
✅ Serveur Mariama : 2 commandes (Tables 2, 8)
✅ Toutes les commandes créées sans erreur
✅ Stock automatiquement décrémenté
```

### Résultats attendus
- ✅ Toutes les commandes tracées correctement
- ✅ Aucune perte de données
- ✅ Stock cohérent
- ✅ Factures générées pour tous les paiements
- ✅ Temps de réponse API < 2 secondes

### Critères de succès
- [ ] 100% des commandes payées
- [ ] 0 erreur serveur
- [ ] 0 plainte client sur le temps d'attente
- [ ] Stock final = Stock initial - Quantités vendues

---

## SCÉNARIO 2 : Gestion de rupture de stock

### Contexte
Le Yassa Poulet est très demandé et le stock atteint zéro.

### Acteurs
- Serveur (Abdou)
- Gérant (Fatou)

### Déroulement

**Situation initiale**
```
Stock Yassa Poulet : 5 portions
track_stock: true
```

**13h10 - Commande qui épuise le stock**
```
✅ Serveur crée commande Table 12 : 5x Yassa Poulet
✅ Commande acceptée
✅ Stock décrémenté : 5 → 0
```

**13h15 - Tentative commande suivante**
```
✅ Serveur tente commande Table 15 : 3x Yassa Poulet
❌ Erreur reçue : "Stock insuffisant pour Yassa Poulet"
✅ Serveur informe le client
✅ Client choisit alternative (Mafé)
✅ Nouvelle commande créée avec succès
```

**13h20 - Réapprovisionnement**
```
✅ Gérant Fatou met à jour le stock : +20 portions
✅ Yassa Poulet redevient disponible
✅ Commandes reprennent normalement
```

### Résultats attendus
- ✅ Commandes bloquées quand stock = 0
- ✅ Message d'erreur clair en français
- ✅ Pas de stock négatif dans la base
- ✅ Réapprovisionnement immédiatement pris en compte

### Critères de succès
- [ ] Aucune vente avec stock négatif
- [ ] Message erreur compris par le serveur
- [ ] Délai de mise à jour stock < 1 seconde

---

## SCÉNARIO 3 : Double paiement (protection)

### Contexte
Client impatient demande deux fois au caissier de vérifier son paiement.

### Acteurs
- Caissier (Aminata)
- Client anxieux

### Déroulement

**14h00 - Paiement initial**
```
✅ Commande Table 7 : 9500 FCFA
✅ Caissier crée paiement Mobile Money
✅ Client effectue paiement Wave
✅ Client donne code : WV456123789
✅ Caissier vérifie → Succès
✅ Facture générée
```

**14h02 - Tentative de re-vérification**
```
✅ Client redemande "Vous êtes sûr que c'est payé ?"
✅ Caissier clique à nouveau sur vérifier
❌ Erreur reçue : "Paiement déjà vérifié"
✅ Caissier rassure le client avec la facture
```

**14h05 - Tentative de nouveau paiement sur même commande**
```
✅ Par erreur, caissier essaie de créer un 2e paiement
❌ Erreur : "Cette commande a déjà été payée"
✅ Système protégé contre le double paiement
```

### Résultats attendus
- ✅ Impossible de payer 2 fois la même commande
- ✅ Impossible de vérifier 2 fois le même paiement
- ✅ Messages d'erreur clairs
- ✅ Aucune perte financière

### Critères de succès
- [ ] 0 double paiement enregistré
- [ ] Protection fonctionnelle à 100%
- [ ] Caissier comprend les messages d'erreur

---

## SCÉNARIO 4 : Annulation de commande

### Contexte
Client change d'avis ou serveur fait une erreur de saisie.

### Acteurs
- Serveur (Mariama)

### Déroulement

**14h30 - Erreur de saisie**
```
✅ Serveur crée commande Table 4 : 5x Thiéboudienne
✅ Client dit "Non, c'était 2 seulement"
✅ Serveur annule la commande (statut: cancelled)
✅ Stock restauré automatiquement (+5 Thiéboudienne)
✅ Serveur crée nouvelle commande : 2x Thiéboudienne
```

**14h35 - Tentative d'annulation commande payée**
```
✅ Commande Table 6 déjà payée
✅ Client finalement ne veut plus
✅ Gérant tente d'annuler
❌ Erreur : "Impossible d'annuler une commande payée. Effectuez un remboursement."
✅ Gérant comprend qu'il faut procédure remboursement
```

### Résultats attendus
- ✅ Annulation avant paiement : OK + stock restauré
- ✅ Annulation après paiement : Bloquée
- ✅ Stock toujours cohérent

### Critères de succès
- [ ] Stock restauré = quantités annulées
- [ ] Commande payée non annulable
- [ ] Workflow alternatif (remboursement) compris

---

## SCÉNARIO 5 : Fin de journée - Clôture de caisse

### Contexte
15h30, fin du service, le restaurant fait le bilan.

### Acteurs
- Gérant (Fatou)
- Caissier (Aminata)

### Déroulement

**Récupération des données du jour**
```
✅ Gérant se connecte
✅ Filtre commandes par date : today
✅ Récupère liste de toutes les commandes
✅ Compte :
   - Commandes completed : 28
   - Commandes cancelled : 3
   - Commandes pending : 1 (oubliée)
```

**Calcul du chiffre d'affaires**
```
✅ Somme des paiements completed : 156,700 FCFA
✅ Répartition par méthode :
   - Mobile Money : 142,500 FCFA (20 paiements)
   - Cash : 14,200 FCFA (8 paiements)
```

**Vérification cohérence stock**
```
✅ Produit le plus vendu : Yassa Poulet (34 portions)
✅ Stock initial : 50
✅ Stock final : 16
✅ Cohérence : 50 - 34 = 16 ✅
```

**Export factures**
```
✅ Téléchargement de toutes les factures du jour
✅ 28 PDF générés et accessibles
✅ Archivage pour comptabilité
```

### Résultats attendus
- ✅ Données agrégées correctes
- ✅ Stock cohérent avec les ventes
- ✅ Toutes les factures disponibles
- ✅ Reporting exploitable pour la comptabilité

### Critères de succès
- [ ] CA calculé = Somme des paiements completed
- [ ] Stock final cohérent pour tous les produits avec track_stock
- [ ] 100% des commandes payées ont une facture
- [ ] Export factures fonctionnel

---

## SCÉNARIO 6 : Panne réseau pendant paiement

### Contexte
Connexion internet instable, coupure pendant une vérification de paiement.

### Acteurs
- Caissier (Aminata)
- Client

### Déroulement

**14h45 - Paiement en cours**
```
✅ Commande Table 10 : 12,300 FCFA
✅ Caissier crée paiement Mobile Money
✅ Client effectue paiement Orange Money
✅ Client donne code : OM741852963
✅ Caissier clique sur "Vérifier"
❌ Erreur réseau : timeout API
```

**14h47 - Reconnexion**
```
✅ Internet revient
✅ Caissier re-clique sur "Vérifier"
✅ Vérification réussie
✅ Facture générée
✅ Paiement enregistré 1 seule fois (pas de doublon)
```

### Résultats attendus
- ✅ Résilience aux coupures réseau
- ✅ Possibilité de re-tenter la vérification
- ✅ Pas de doublon de paiement
- ✅ Transaction idempotente

### Critères de succès
- [ ] Paiement enregistré 1 seule fois
- [ ] Code transaction protège contre les doublons
- [ ] Expérience utilisateur claire (message erreur réseau)

---

## SCÉNARIO 7 : Multi-utilisateurs simultanés

### Contexte
Tous les employés utilisent le système en même temps.

### Acteurs
- 2 serveurs
- 1 caissier
- 1 gérant

### Déroulement

**13h00 - Activité simultanée**
```
Serveur 1 : Crée commande Table 3
Serveur 2 : Crée commande Table 5
Caissier   : Vérifie paiement Table 1
Gérant     : Modifie prix produit "Mafé"
```

**Vérifications**
```
✅ Toutes les actions réussies
✅ Aucun conflit de données
✅ Chaque utilisateur voit ses propres commandes
✅ Modification prix Mafé : visible immédiatement pour tous
```

### Résultats attendus
- ✅ Isolation des transactions
- ✅ Cohérence des données
- ✅ Pas de blocage concurrentiel
- ✅ Latence acceptable (< 2s)

### Critères de succès
- [ ] 0 erreur de concurrence
- [ ] Temps de réponse moyen < 2 secondes
- [ ] Données toujours à jour pour tous les utilisateurs

---

## SCÉNARIO 8 : Onboarding nouveau restaurant

### Contexte
Nouveau restaurant s'inscrit et doit être opérationnel en 30 minutes.

### Acteurs
- Installateur Bizon
- Propriétaire restaurant

### Déroulement

**Minute 0 - Inscription**
```
✅ Email : nouveaurestaurant@test.sn
✅ Mot de passe : Test1234!
✅ Nom restaurant : Chez Yaya
✅ Inscription réussie → Token reçu
Temps : 2 minutes
```

**Minute 2 - Onboarding automatique**
```
✅ Appel POST /api/onboarding/setup
✅ Menu par défaut créé
✅ 4 catégories + 10 produits
Temps : 30 secondes
```

**Minute 3 - Personnalisation menu**
```
✅ Modification 3 prix
✅ Ajout 5 nouveaux produits
✅ Suppression 2 produits non pertinents
✅ Ajout catégorie "Grillades"
Temps : 10 minutes
```

**Minute 13 - Création utilisateurs**
```
✅ Ajout serveur : Moussa
✅ Ajout caissier : Aïssatou
Temps : 3 minutes
```

**Minute 16 - Test commande complète**
```
✅ Serveur Moussa se connecte
✅ Crée commande test
✅ Caissier Aïssatou encaisse
✅ Facture générée
Temps : 5 minutes
```

**Minute 21 - Formation équipe**
```
✅ Explication workflow serveur
✅ Explication workflow caissier
✅ Questions/réponses
Temps : 9 minutes
```

### Résultats attendus
- ✅ Restaurant opérationnel en 30 minutes
- ✅ Équipe formée et autonome
- ✅ Menu personnalisé et exploitable
- ✅ 1 commande test validée avec succès

### Critères de succès
- [ ] Temps total installation < 30 minutes
- [ ] Équipe comprend le système
- [ ] Commande test réussie du premier coup
- [ ] Restaurant prêt pour le service

---

## SCÉNARIO 9 : Reporting et statistiques

### Contexte
Gérant veut analyser les performances de la semaine.

### Acteurs
- Gérant (Fatou)

### Déroulement

**Consultation des ventes**
```
✅ Période : 7 derniers jours
✅ Total ventes : 1,245,800 FCFA
✅ Nombre de commandes : 187
✅ Panier moyen : 6,660 FCFA
```

**Top produits**
```
1. Yassa Poulet : 238 portions vendues
2. Thiéboudienne : 156 portions
3. Bissap : 421 verres
```

**Répartition paiements**
```
- Mobile Money : 85% (1,058,930 FCFA)
- Cash : 15% (186,870 FCFA)
```

**Détection tendances**
```
✅ Pic de vente : Vendredi 13h-14h
✅ Produit en forte demande : Yassa Poulet
✅ Catégorie la plus rentable : Plats principaux
```

### Résultats attendus
- ✅ Données agrégées correctes
- ✅ Insights exploitables
- ✅ Support décisions business

### Critères de succès
- [ ] Données cohérentes avec les commandes réelles
- [ ] Calculs automatiques corrects
- [ ] Visualisation claire (via PWA ou export)

---

## SCÉNARIO 10 : Gestion abonnement

### Contexte
Fin de la période d'essai de 14 jours.

### Acteurs
- Propriétaire restaurant

### Déroulement

**Jour 12 - Notification pré-expiration**
```
✅ Email envoyé : "Votre essai expire dans 2 jours"
✅ Message dans l'interface
```

**Jour 14 - Expiration**
```
✅ Connexion toujours possible
⚠️ Tentative de créer commande : Bloquée
⚠️ Message : "Votre abonnement a expiré. Veuillez le renouveler."
✅ Consultation des données anciennes : OK
```

**Jour 15 - Renouvellement**
```
✅ Propriétaire souscrit abonnement mensuel
✅ Paiement validé
✅ Abonnement réactivé immédiatement
✅ Création commandes à nouveau possible
```

### Résultats attendus
- ✅ Expiration abonnement bloque les actions
- ✅ Lecture des données reste possible
- ✅ Renouvellement instantané

### Critères de succès
- [ ] Actions bloquées après expiration
- [ ] Données préservées
- [ ] Réactivation instantanée après paiement

---

## 📋 CHECKLIST GLOBALE DE VALIDATION

Avant de déclarer Bizon prêt pour le terrain:

### Fonctionnalités core
- [ ] Inscription restaurant
- [ ] Onboarding automatique
- [ ] Création commandes
- [ ] Gestion stock automatique
- [ ] Paiements Mobile Money
- [ ] Génération factures PDF
- [ ] Annulation commandes (avec restauration stock)
- [ ] Multi-utilisateurs (rôles)

### Protections critiques
- [ ] Double paiement bloqué
- [ ] Stock négatif impossible
- [ ] Commande payée non annulable
- [ ] Code transaction unique
- [ ] Isolation multi-tenant parfaite

### Expérience utilisateur
- [ ] Messages d'erreur en français
- [ ] Messages clairs et actionnables
- [ ] Temps de réponse < 2 secondes
- [ ] Interface intuitive (PWA)

### Fiabilité
- [ ] Logs exploitables
- [ ] Aucune perte de données
- [ ] Résilience aux pannes réseau
- [ ] Transactions atomiques

### Documentation
- [ ] Guide d'installation
- [ ] Formation utilisateurs
- [ ] API documentée
- [ ] Support disponible

---

## 🎯 MÉTRIQUES DE SUCCÈS

### KPIs à mesurer pendant les tests

| Métrique | Objectif | Critique |
|----------|----------|----------|
| Temps d'installation | < 30 min | ⚠️ Oui |
| Taux d'erreur API | < 0.1% | ⚠️ Oui |
| Temps réponse moyen | < 2s | ⚠️ Oui |
| Satisfaction utilisateurs | > 8/10 | ⚠️ Oui |
| Commandes réussies | 100% | ⚠️ Oui |
| Cohérence stock | 100% | ⚠️ Oui |
| Factures générées | 100% | ⚠️ Oui |
| Double paiement | 0 | ⚠️ Oui |

---

✅ **Ces scénarios couvrent l'intégralité des cas d'usage réels. Validation terrain prévue avec 2-3 restaurants pilotes.**
