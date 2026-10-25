# MP Nexus en plein écran dans l’application Home Assistant iOS

MP Nexus occupe désormais la hauteur visible de la vue intégrée, y compris après rotation de l’iPhone, et respecte les zones de sécurité autour de l’encoche et du bas de l’écran.

Pour retirer aussi la barre d’état native de l’iPhone, activez **Réglages → Application compagnon → Mode kiosque → Activé**, choisissez le tableau de bord **MP Nexus**, puis activez **Masquer la barre d’état** et **Masquer la barre latérale et les contrôles du haut**. Ces options appartiennent à l’application iOS et ne peuvent pas être changées par le code d’un tableau de bord. Le mode kiosque nécessite une version récente de l’application et, pour les contrôles Home Assistant, un frontend qui prend en charge ce mode.

Référence : [Home Assistant Companion — iOS Kiosk mode](https://companion.home-assistant.io/docs/integrations/ios-kiosk-mode/).
