# Générer un plan 3D sans add-on

Depuis **MP Glass 0.2.1**, Gemini peut être utilisé directement depuis l’intégration. Aucun add-on, Docker, port réseau ou clé de liaison supplémentaire n’est nécessaire.

Après mise à jour de l’intégration et redémarrage de Home Assistant :

1. **Paramètres → Appareils et services → MP Glass → Configurer**. Choisir **Gemini direct — sans add-on** puis coller la **clé API Gemini** et valider. Si MP Glass est déjà relié à un add-on, changer ce sélecteur explicitement ; le mode existant est conservé lors de la mise à jour.
2. **MP Glass Studio → Plan 3D**. Choisir une image ou un PDF, indiquer la page à analyser, autoriser l’envoi à Google et cliquer **Générer le brouillon 3D**.
3. Vérifier le brouillon, cliquer **Utiliser pour ce niveau**, corriger l’échelle et les pièces puis **Enregistrer** dans le Studio.

Le lien **Configurer Gemini** dans le Studio ouvre la fiche de l’intégration. Le lien **Obtenir une clé API** ouvre [Google AI Studio](https://aistudio.google.com/api-keys). La clé reste dans les options de l’intégration, jamais dans l’export du projet, le JavaScript ou les diagnostics MP Glass.

Dans les mêmes options, **Modèle d’analyse des plans** : **Gemini 3.8 Flash** (le plus précis, par défaut) ou **Gemini 3.5 Flash-Lite** (le plus rapide), tous deux au palier gratuit de Google. Pour rester dans les quotas gratuits, utiliser une clé provenant d’un projet Google sans facturation activée. Les quotas peuvent évoluer ; aucune substitution de modèle n’est déclenchée automatiquement. Seule une requête refusée comme invalide (HTTP 400, non facturée) est renvoyée sous des formes allégées (sans schéma de réponse, puis sans réflexion approfondie).

**Envoi du document :** un PDF est dessiné dans le navigateur ; seule la page choisie est envoyée à Google, en image, sans les autres pages ni les métadonnées du fichier. Une image est envoyée telle quelle, réduite au-delà de 3 072 pixels. MP Glass vérifie taille, type et signature, puis lit seulement les dimensions de l’image dans son en-tête. Gemini détecte les pièces ; l’échelle et la géométrie sont calculées par MP Glass (voir [Analyse du plan](FLOORPLAN.md#analyse-du-plan)).

PNG, JPEG, WebP et PDF acceptés jusqu’à 8 Mo. Le résultat reste un brouillon ; la précision de reconnaissance doit être vérifiée sur le plan réel.

## En cas d’échec

Depuis 0.2.2, le Studio affiche la cause et, sous le message, le **détail technique** renvoyé par Google. Le même code apparaît dans **Paramètres → Système → Journaux** (`MP Glass plan analysis failed`), sans le document ni la clé.

| Message | Que faire |
| --- | --- |
| Service d’import introuvable | L’intégration n’est pas à jour : remplacer `custom_components/mp_glass`, redémarrer HA, vider le cache du navigateur. |
| Clé API Gemini refusée | Recoller la clé dans les options (elle commence par `AIza`), vérifier que l’API est activée pour ce projet. |
| Accès refusé (région ou facturation) | Le palier gratuit n’est pas ouvert à ce projet ou à ce pays : voir le détail Google. |
| Modèle refusé (HTTP 404 `NOT_FOUND`, « no longer available to new users ») | Le modèle n’est plus ouvert à ce projet : mettre à jour MP Glass (modèle par défaut `gemini-3.5-flash-lite`) et redémarrer HA. En mode add-on, corriger l’option `model` du worker. |
| Gemini a refusé la requête (HTTP 400 `INVALID_ARGUMENT`) | MP Glass a déjà réessayé sous des formes allégées : le document est probablement en cause. Exporter la page du plan en PNG ou JPEG (capture d’écran nette) et relancer. Le détail technique indique le champ refusé quand Google le précise. |
| Gemini surchargé | Réessayer quelques minutes plus tard. |
| Aucune pièce reconnue / réponse coupée | Vérifier le numéro de page, importer un seul niveau, une image plus nette ou recadrée. |
| Google injoignable | Vérifier l’accès Internet et le DNS de Home Assistant. |

Les pièces mal tracées par Gemini sont corrigées ou ignorées avec un avertissement, au lieu de faire échouer tout le plan.

Le mode avancé **Add-on Spatial** conserve la conversion locale de la page choisie en image sans métadonnées. Il est facultatif. [Installation avancée](../addons/mp_glass_spatial/DOCS.md).

Version préparée et testée localement ; mise à jour de l’instance HA et appel Gemini réel restant à effectuer.

[Traitement natif des PDF par Gemini](https://ai.google.dev/gemini-api/docs/generate-content/document-processing) · [Tarification](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite).
