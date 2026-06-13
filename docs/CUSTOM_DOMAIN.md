# Domaine personnalisé par restaurant

Permet à un restaurant d'avoir sa propre adresse (ex. `commande.chez-paul.cm`)
qui ouvre directement **son** menu, au lieu du lien générique `…/?r=<slug>`.

## Comment ça marche

L'app résout le restaurant à partir du **nom d'hôte** de la requête :

1. `custom_domain` exact (ex. `commande.chez-paul.cm`) ;
2. sinon, sous-domaine = `slug` (ex. `chez-paul.bizon.cm`) ;
3. sinon, paramètre d'URL `?restaurantId=` / `?r=<slug>` ;
4. sinon, premier restaurant actif.

La résolution lit `x-forwarded-host` (en-tête posé par Render), donc elle
fonctionne derrière le proxy de l'hébergeur.

## Mettre un domaine en service (3 étapes)

1. **Back-office plateforme** → carte du restaurant → **Domaine personnalisé** :
   saisir `commande.chez-paul.cm`.
2. **DNS** (chez le registrar du restaurateur) : créer un enregistrement
   `CNAME` du domaine vers l'hôte de l'app Render (ex. `bizon.onrender.com`).
   Pour un domaine **apex** (`chez-paul.cm` sans sous-domaine), utiliser un
   ALIAS/ANAME ou les enregistrements A fournis par Render.
3. **Hébergeur (Render)** → service web → **Settings → Custom Domains** →
   *Add Custom Domain* → `commande.chez-paul.cm`. Render vérifie le DNS puis
   émet automatiquement le certificat TLS (HTTPS).

> ⚠️ Les 3 étapes sont nécessaires : enregistrer le domaine côté Bizon ne
> suffit pas si l'hébergeur ne route pas ce domaine vers l'app.

## Vérifier que c'est « live »

Bouton **« Vérifier le domaine »** sur la carte du restaurant (apparaît dès
qu'un domaine est enregistré). Il interroge réellement
`https://<domaine>/api/public/whoami` et affiche :

| Statut | Signification | Action |
|---|---|---|
| ✅ **Actif** | Le domaine sert bien ce restaurant. | Rien à faire. |
| ⏳ **Injoignable** | DNS pas encore propagé, TLS absent, ou domaine non ajouté sur Render. | Refaire l'étape 2/3, attendre la propagation DNS (jusqu'à ~1 h). |
| ⚠️ **Non résolu** | Joignable mais aucun restaurant résolu pour ce Host. | Vérifier l'orthographe exacte du `custom_domain`. |
| ❌ **Mauvais restaurant** | Le domaine pointe vers un autre restaurant. | Un autre resto utilise ce domaine/sous-domaine : corriger. |

### Sonde technique

`GET /api/public/whoami` renvoie le restaurant résolu par le seul Host :

```json
{ "resolved": true, "host": "commande.chez-paul.cm",
  "restaurant": { "id": "…", "name": "Chez Paul", "slug": "chez-paul", "custom_domain": "commande.chez-paul.cm" } }
```

`GET /api/admin/restaurants/:id/verify-domain` (super-admin) appelle cette
sonde côté serveur et renvoie l'un des statuts ci-dessus.
