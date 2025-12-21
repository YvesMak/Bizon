# 🚨 PROCÉDURE ROLLBACK D'URGENCE - Bizon MVP

**Document de gestion de crise pour tests pilotes**  
**À utiliser en cas de bug critique bloquant l'exploitation**

---

## ⚠️ QUAND UTILISER CETTE PROCÉDURE ?

### Situations critiques nécessitant rollback :

#### 🔴 Niveau CRITIQUE (activation immédiate)

1. **Perte de données commandes** :
   - Commandes disparaissent de la base
   - Historique effacé
   - Impossibilité de retrouver transactions

2. **Impossibilité totale d'encaisser** :
   - Tous les paiements échouent
   - Génération factures impossible
   - Blocage caisse > 30 minutes

3. **Corruption base de données** :
   - Erreurs PostgreSQL systématiques
   - Données incohérentes (stocks négatifs massifs, totaux faux)
   - Impossibilité de se connecter

4. **Faille sécurité** :
   - Accès non autorisé détecté
   - Fuite de données entre restaurants
   - Exploitation de vulnérabilité

#### 🟠 Niveau MAJEUR (évaluation avant activation)

1. **Bug bloquant une fonctionnalité clé** :
   - Prise de commande impossible (mais caisse OK)
   - Paiements échouent > 50% du temps
   - Menu inaccessible

2. **Performance dégradée** :
   - Temps de réponse > 10 secondes systématiques
   - Timeouts fréquents
   - Serveur surchargé

3. **Bug financier** :
   - Calculs totaux erronés
   - Double débit clients
   - Factures montants incorrects

---

## 🛠️ PROCÉDURE ROLLBACK ÉTAPE PAR ÉTAPE

### Phase 1️⃣ : ALERTE & ÉVALUATION (5 minutes)

#### Action 1 : Contacter restaurant pilote immédiatement

```
📞 APPEL TÉLÉPHONIQUE (ne pas attendre WhatsApp)

"Bonjour [Gérant], nous avons détecté un problème technique critique 
sur Bizon. Pour votre sécurité et celle de vos clients, nous allons 
temporairement désactiver le système et revenir à votre ancien process. 
Pouvez-vous confirmer que vous avez bien un moyen de continuer votre 
service sans Bizon ?"

✅ OUI → Continuer procédure rollback
❌ NON → Intervention sur place urgente + rollback
```

#### Action 2 : Évaluer l'ampleur

- [ ] Combien de restaurants affectés ? (1 ou tous ?)
- [ ] Depuis quand ? (logs Winston)
- [ ] Pertes de données ? (vérifier backups)
- [ ] Impact financier ? (commandes/paiements perdus)

#### Action 3 : Décider GO/NO-GO rollback

| Critère | Rollback | Workaround |
|---------|----------|------------|
| Perte données | OUI | NON |
| Impossibilité encaisser | OUI | NON |
| Bug > 50% fonctions | OUI | NON |
| Bug 1 seule fonction | NON | OUI |
| Performance lente | NON | OUI |

---

### Phase 2️⃣ : SAUVEGARDE DONNÉES (10 minutes)

#### Action 4 : Backup base de données

```bash
# Sur serveur production
cd /private/tmp/Perso/bizon

# Backup PostgreSQL complet
pg_dump -U yves bizon_db > backups/emergency_backup_$(date +%Y%m%d_%H%M%S).sql

# Vérifier taille backup (doit être > 0)
ls -lh backups/emergency_backup_*.sql

# Copier vers S3 / Google Drive (si configuré)
aws s3 cp backups/emergency_backup_*.sql s3://bizon-backups/

# Ou copier localement
cp backups/emergency_backup_*.sql ~/Desktop/
```

#### Action 5 : Export données restaurant pilote

```bash
# Export CSV toutes les tables du restaurant
node scripts/export-restaurant-data.js --restaurant_id=<UUID> --output=restaurant_export.csv
```

#### Action 6 : Vérifier intégrité backup

```bash
# Test restore dans DB temporaire
createdb bizon_db_test
psql bizon_db_test < backups/emergency_backup_*.sql

# Compter lignes
psql bizon_db_test -c "SELECT COUNT(*) FROM orders;"
psql bizon_db_test -c "SELECT COUNT(*) FROM payments;"

# Si OK, supprimer DB test
dropdb bizon_db_test
```

---

### Phase 3️⃣ : ARRÊT SERVEUR (2 minutes)

#### Action 7 : Arrêter serveur Node.js

```bash
# Si PM2 (production)
pm2 stop bizon-server
pm2 save

# Si process manuel (dev)
pkill -f "node src/server.js"

# Vérifier arrêt
curl http://localhost:3000/health
# Doit retourner : Connection refused
```

#### Action 8 : Afficher page maintenance

```bash
# Créer page maintenance
cat > /var/www/maintenance.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Bizon - Maintenance</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial; text-align: center; padding: 50px; }
        h1 { color: #e74c3c; }
    </style>
</head>
<body>
    <h1>🚨 Maintenance technique en cours</h1>
    <p>Bizon est temporairement indisponible pour maintenance d'urgence.</p>
    <p>Reprise estimée : < 2 heures</p>
    <p><strong>Contact support : +221 XX XXX XXXX</strong></p>
</body>
</html>
EOF

# Configurer Nginx pour afficher cette page
sudo nano /etc/nginx/sites-available/bizon
# Ajouter : return 503; et error_page 503 /maintenance.html;
sudo nginx -s reload
```

---

### Phase 4️⃣ : COMMUNICATION CLIENTS (5 minutes)

#### Action 9 : Notifier restaurant pilote par TOUS les canaux

**📞 Téléphone** :
```
"Le système est arrêté. Vous pouvez reprendre votre ancien 
process (papier/oral). Nous intervenons sur place dans l'heure 
pour vous aider et récupérer les données perdues s'il y en a."
```

**📱 WhatsApp** :
```
🚨 ALERTE BIZON - Arrêt temporaire

Le système Bizon est désactivé pour maintenance d'urgence.

✅ VOS ACTIONS :
- Reprendre votre ancien système (papier/oral)
- Noter commandes/paiements manuellement
- On récupérera ces données après

❌ NE PAS :
- Essayer de vous reconnecter à Bizon
- Paniquer - vos données sont sauvegardées

📞 On vous rappelle dans 15 minutes avec plan d'action.
Support : +221 XX XXX XXXX
```

**📧 Email** (copie):
```
Objet : [URGENT] Bizon temporairement désactivé

Bonjour [Gérant],

Suite à un problème technique critique, nous avons dû 
désactiver Bizon temporairement pour votre sécurité.

ACTIONS IMMÉDIATES :
1. Reprendre votre ancien système
2. Noter transactions manuellement
3. Nous intervenons sur place sous 1h

COMPENSATION :
- Prolongation période gratuite
- Compensation financière si perte exploitation
- Support sur place illimité

Nos sincères excuses pour la gêne occasionnée.

Équipe Bizon
+221 XX XXX XXXX
```

#### Action 10 : Notifier équipe interne

**Slack / Discord / Email équipe** :
```
🚨 ROLLBACK ACTIVÉ - Restaurant [Nom]

Bug critique : [Description courte]
Impact : [Nombre restaurants / Fonctions bloquées]
Rollback : EN COURS
ETA résolution : < 2 heures

Actions en cours :
- ✅ Backup DB effectué
- ✅ Serveur arrêté
- ✅ Restaurant notifié
- ⏳ Investigation bug en cours
- ⏳ Intervention sur place programmée

Responsable : [Nom dev]
```

---

### Phase 5️⃣ : INTERVENTION SUR PLACE (dans l'heure)

#### Action 11 : Se rendre au restaurant

**Matériel à apporter** :
- [ ] Laptop avec backup DB
- [ ] Smartphone hotspot 4G (si WiFi instable)
- [ ] Carnet + stylo (noter process manuel)
- [ ] Clé USB (copie backup)
- [ ] Contrat compensation (si perte financière)

**Objectifs visite** :
1. Rassurer gérant et équipe
2. Récupérer données transactions manuelles (depuis arrêt)
3. Expliquer cause du bug
4. Établir compensation si nécessaire
5. Planifier reprise (ou arrêt définitif test)

#### Action 12 : Récupérer transactions manuelles

```
Demander au restaurant :
- Notes commandes prises sur papier (depuis arrêt Bizon)
- Tickets caisse manuels
- Montants encaissés Mobile Money

Les saisir dans Excel pour import ultérieur :
| Heure | Produits | Quantité | Montant | Méthode paiement |
|-------|----------|----------|---------|------------------|
```

#### Action 13 : Compensation immédiate

Si perte financière avérée (ex: client parti sans payer à cause du bug) :

```
"Nous prenons en charge cette perte. Voici [Montant FCFA] 
en compensation immédiate. Un reçu officiel suivra par email."
```

Si stress / temps perdu :

```
"En compensation de la gêne, nous offrons :
- +1 mois gratuit supplémentaire
- Support sur place illimité jusqu'à stabilisation
- Tarif préférentiel doublé si vous continuez"
```

---

### Phase 6️⃣ : INVESTIGATION & CORRECTION (2-24 heures)

#### Action 14 : Analyser logs d'erreur

```bash
# Logs Winston
cd /private/tmp/Perso/bizon/logs
tail -500 error-2025-12-20.log

# Chercher patterns
grep "ERROR" combined-2025-12-20.log | tail -100

# Logs PostgreSQL
sudo tail -100 /usr/local/var/log/postgresql@15.log
```

#### Action 15 : Reproduire bug en local

```bash
# Créer DB test avec backup
createdb bizon_db_test_debug
psql bizon_db_test_debug < backups/emergency_backup_*.sql

# Modifier .env
DB_NAME=bizon_db_test_debug

# Lancer serveur en mode debug
NODE_ENV=development DEBUG=* node src/server.js
```

#### Action 16 : Corriger bug

```bash
# Créer branche fix
git checkout -b hotfix/critical-bug-YYYY-MM-DD

# Modifier code
nano src/modules/[module]/service.js

# Tester correction
npm test

# Commit
git add .
git commit -m "🚨 HOTFIX: [Description bug]"

# Merge dans main
git checkout main
git merge hotfix/critical-bug-YYYY-MM-DD
```

#### Action 17 : Tester correction en staging

```bash
# Déployer en staging
git push staging main

# Tester tous les scénarios
./test-onboarding.sh
./test-security.sh
./test-pwa-ready.sh

# Tester scénario qui a causé le bug (reproduction)
```

---

### Phase 7️⃣ : REPRISE SERVICE (1-2 heures)

#### Action 18 : Restaurer backup (si données corrompues)

```bash
# ATTENTION : Écrase DB actuelle
psql bizon_db < backups/emergency_backup_YYYYMMDD_HHMMSS.sql

# Vérifier intégrité
psql bizon_db -c "SELECT COUNT(*) FROM orders WHERE created_at > '2025-12-20';"
```

#### Action 19 : Importer transactions manuelles

```bash
# Depuis Excel restaurant
node scripts/import-manual-transactions.js \
  --restaurant_id=<UUID> \
  --file=transactions_manuelles.csv
```

#### Action 20 : Redémarrer serveur

```bash
# Production PM2
pm2 start ecosystem.config.js
pm2 logs

# Vérifier health check
curl http://localhost:3000/health
# Doit retourner : {"status":"ok"}

# Retirer page maintenance Nginx
sudo nano /etc/nginx/sites-available/bizon
# Supprimer : return 503;
sudo nginx -s reload
```

#### Action 21 : Tests de non-régression

```bash
# Tester tous les endpoints critiques
./test-critical-endpoints.sh

# Tester scénario qui a causé le bug
# [Décrire scénario spécifique]

# Monitoring 30 minutes
pm2 monit
tail -f logs/combined-*.log
```

---

### Phase 8️⃣ : COMMUNICATION REPRISE (15 minutes)

#### Action 22 : Notifier restaurant

**📞 Téléphone + WhatsApp** :
```
✅ BIZON DE RETOUR

Le problème est résolu, Bizon est de nouveau opérationnel.

CE QUI A ÉTÉ FAIT :
- Bug [Description] corrigé
- Vos données sauvegardées et restaurées
- Transactions manuelles importées
- Tests complets effectués

VOUS POUVEZ :
- Vous reconnecter normalement
- Reprendre l'utilisation Bizon
- Nous contacter au moindre doute

COMPENSATION :
- [Détails compensation décidée]

Merci de votre patience et compréhension 🙏
```

#### Action 23 : Post-mortem interne

```markdown
# POST-MORTEM : Rollback [Date]

## Chronologie
- HH:MM : Détection bug
- HH:MM : Rollback décidé
- HH:MM : Serveur arrêté
- HH:MM : Restaurant notifié
- HH:MM : Intervention sur place
- HH:MM : Correction déployée
- HH:MM : Serveur redémarré

## Cause racine
[Explication technique du bug]

## Impact
- Restaurants affectés : X
- Durée indisponibilité : X heures
- Commandes perdues : X
- Perte financière : X FCFA

## Actions correctives
1. [Correction code]
2. [Tests ajoutés]
3. [Monitoring ajouté]
4. [Process amélioré]

## Leçons apprises
- [Ce qu'on aurait dû faire différemment]
- [Ce qui a bien fonctionné]

## Prévention future
- [ ] Ajouter tests automatisés pour ce cas
- [ ] Améliorer monitoring
- [ ] Former équipe sur cette procédure
```

---

## 📋 CHECKLIST ROLLBACK COMPLÈTE

### Avant rollback :
- [ ] Bug confirmé critique (pas de workaround)
- [ ] Restaurant contacté par téléphone
- [ ] Backup DB effectué et vérifié
- [ ] Équipe interne notifiée

### Pendant rollback :
- [ ] Serveur arrêté proprement
- [ ] Page maintenance affichée
- [ ] Restaurant notifié (téléphone + WhatsApp + email)
- [ ] Intervention sur place planifiée (< 1h)
- [ ] Compensation décidée

### Après rollback :
- [ ] Bug corrigé et testé
- [ ] Backup restauré si nécessaire
- [ ] Transactions manuelles importées
- [ ] Serveur redémarré et testé
- [ ] Restaurant notifié reprise
- [ ] Post-mortem rédigé
- [ ] Actions préventives planifiées

---

## 💰 GRILLE COMPENSATION

| Type d'incident | Durée | Compensation |
|-----------------|-------|--------------|
| **Indisponibilité totale** | < 1h | +2 semaines gratuites |
| **Indisponibilité totale** | 1-4h | +1 mois gratuit |
| **Indisponibilité totale** | > 4h | +2 mois gratuits |
| **Perte données < 10 commandes** | - | +1 mois gratuit |
| **Perte données > 10 commandes** | - | +3 mois gratuits |
| **Perte financière** | - | Remboursement 100% + 1 mois gratuit |
| **Stress majeur équipe** | - | +1 mois gratuit + support sur place |

**Note** : Compensations cumulables selon gravité.

---

## 🚨 CONTACTS D'URGENCE

### Équipe technique :
- **CTO** : [Nom] - +221 XX XXX XXXX
- **Lead Dev** : [Nom] - +221 YY YYY YYYY
- **Support** : support@bizon.app

### Fournisseurs critiques :
- **Hébergeur** : [Nom service] - [Contact]
- **PostgreSQL DBA** : [Nom] - [Contact]
- **Nginx admin** : [Nom] - [Contact]

### Restaurant pilote :
- **Gérant** : [Nom] - [Téléphone]
- **Manager** : [Nom] - [Téléphone]
- **Adresse** : [Adresse complète]

---

## 📚 SCRIPTS UTILES

### Script 1 : Backup automatique

```bash
#!/bin/bash
# backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/private/tmp/Perso/bizon/backups"

echo "🔄 Backup DB Bizon - $DATE"

pg_dump -U yves bizon_db > $BACKUP_DIR/backup_$DATE.sql

if [ $? -eq 0 ]; then
    echo "✅ Backup réussi : backup_$DATE.sql"
    ls -lh $BACKUP_DIR/backup_$DATE.sql
else
    echo "❌ Échec backup"
    exit 1
fi
```

### Script 2 : Health check automatique

```bash
#!/bin/bash
# health-check.sh

HEALTH_URL="http://localhost:3000/health"
MAX_RETRIES=3

for i in $(seq 1 $MAX_RETRIES); do
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)
    
    if [ $RESPONSE -eq 200 ]; then
        echo "✅ Serveur OK"
        exit 0
    else
        echo "⚠️ Tentative $i/$MAX_RETRIES échouée"
        sleep 5
    fi
done

echo "🚨 Serveur DOWN - Rollback nécessaire ?"
exit 1
```

### Script 3 : Export données restaurant

```bash
#!/bin/bash
# export-restaurant-data.sh

RESTAURANT_ID=$1
OUTPUT_FILE="export_${RESTAURANT_ID}_$(date +%Y%m%d).csv"

psql bizon_db -c "COPY (
  SELECT o.*, oi.product_id, oi.quantity, oi.unit_price
  FROM orders o
  LEFT JOIN order_items oi ON o.id = oi.order_id
  WHERE o.restaurant_id = '$RESTAURANT_ID'
) TO STDOUT WITH CSV HEADER" > $OUTPUT_FILE

echo "✅ Export terminé : $OUTPUT_FILE"
```

---

**Document créé le 20 décembre 2025**  
**Procédure testée : NON (à tester en staging)**  
**Dernière mise à jour : 20/12/2025**  
**Version : 1.0**
