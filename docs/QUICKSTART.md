# Premier parcours

Préparation : instance de test HA, une Area Salon, une entité light associée à cette Area directement ou par son device. MP Nexus ne demande pas de nom d'entité particulier.

Installer selon INSTALL, ouvrir MP Nexus Studio. Il s'ouvre en **mode essentiel**, trois étapes : **Analyser** (l'analyse est déjà faite : pièces, lumières et équipements sans pièce comptés), **Pièces** (choisir la pièce des équipements listés sous « Sans pièce », un par un ou en sélectionnant plusieurs puis « Pièce pour la sélection »), **Style** (un préréglage suffit). « Voir le dashboard » est disponible à chaque étape : le dashboard fonctionne avant toute correction. La lumière reçoit une classification issue du domaine et les capabilities issues des attributs HA ; « Pourquoi cette carte ? » l'explique en une phrase. Enregistrer.

MP Nexus Studio crée le dashboard MP Nexus à sa première ouverture. Ouvrir la vue Salon, toucher Allumer et observer l'état serveur. Une lumière déclarant brightness offre un slider ; une lumière onoff n'en offre aucun. Détails utilise le more-info natif.

Le budget « cinq minutes » est un objectif produit ; aucun temps chantier réel n'a encore été mesuré. Résultats courants : VALIDATION.md.
