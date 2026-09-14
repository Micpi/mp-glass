# Changelog

## 0.4.0

Contrat Gemini partagé : les pièces détectées sont renvoyées avec leurs murs alignés, en coordonnées 0–1000, pour être ajustées dans le Studio (poignées, ajout, suppression) puis recalculées par Home Assistant.

## 0.3.1

Contrat Gemini partagé : une surcharge de Google (HTTP 500, 503, 504) déclenche deux nouveaux envois de la même requête, après 4 puis 12 secondes.

## 0.3.0

Contrat Gemini partagé refondu : détection des pièces en boîtes normalisées, géométrie, échelle et découpage sans chevauchement calculés localement, correspondance plan/image renvoyée pour la vérification. Modèle par défaut `gemini-3.8-flash` (tout modèle Flash accepté) ; une installation existante garde son option `model`.

## 0.2.7

Contrat Gemini partagé : schéma de réponse sans limites de longueur de tableau, repli en deux temps après un refus invalide (sans schéma avec réflexion, puis requête la plus simple), chevauchements de pièces signalés.

## 0.2.6

Contrat Gemini partagé : prompt de lecture du plan réécrit (cotes en pieds ou en mètres, pièces jointives, noms en français), réflexion `medium` pour Gemini 3, échelle recalculée à partir des cotes écrites, murs proches alignés, surfaces invraisemblables signalées.

## 0.2.5

Contrat Gemini partagé : sortie limitée à 32 768 jetons, requête refusée comme invalide (HTTP 400) renvoyée une fois sans schéma de réponse, détail des champs refusés par Google.

## 0.2.3

Modèle par défaut `gemini-3.5-flash-lite` : `gemini-2.5-flash-lite` est refusé aux nouveaux projets Google (HTTP 404). Une installation existante garde son option `model`, à corriger. Température par défaut conservée pour Gemini 3, budget de sortie porté à 65 536 jetons.

## 0.2.2

Contrat Gemini partagé mis à jour : schéma compatible, géométrie réparée plutôt que rejetée, erreurs Google détaillées renvoyées à MP Glass.

## 0.2.1

Client Gemini partagé avec l’intégration. Ce worker devient facultatif : le mode Gemini direct de MP Glass fonctionne avec une seule clé API, sans installation d’add-on.

## 0.2.0

Version de développement : import PDF/PNG/JPEG/WebP, rasterisation isolée, Gemini Flash-Lite, JSON validé et API privée. Installation Supervisor et appel Gemini réel restant à valider.
