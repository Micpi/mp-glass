/** The Multimédia page: where the house listens, what to play, which rooms play together. */
export const MEDIA = {
  'Parcourir': ['Browse', 'Обзор'],
  'Groupes': ['Groups', 'Группы'],
  'Pièces et groupes': ['Rooms and groups', 'Комнаты и группы'],
  'Volume du groupe': ['Group volume', 'Громкость группы'],
  'Effacer la recherche': ['Clear the search', 'Очистить поиск'],
  'Ma musique': ['My music', 'Моя музыка'],
  'Autres résultats': ['Other results', 'Другие результаты'],
  'Ajout au groupe…': ['Joining the group…', 'Добавление в группу…'],
  'Retrait du groupe…': ['Leaving the group…', 'Выход из группы…'],
  'Joue avec {room}': ['Plays with {room}', 'Играет вместе с: {room}'],
  'Dans un autre groupe : {group}': ['In another group: {group}', 'В другой группе: {group}'],
  'Joue autre chose : {title}': ['Plays something else: {title}', 'Играет другое: {title}'],
  'Disponible': ['Available', 'Свободна'],
  '{n} pièces jouent ensemble': ['{n} rooms play together', 'Комнат играют вместе: {n}'],
  'Écoute en cours': ['Now listening', 'Сейчас слушают'],
  'Jouer partout': ['Play everywhere', 'Играть везде'],
  'Tout séparer': ['Ungroup all', 'Разделить все'],
  'Pièce principale du groupe': ['Main room of the group', 'Главная комната группы'],
  'Pièce écoutée': ['Room being listened to', 'Выбранная комната'],
  'Cochez une pièce pour qu’elle joue la même chose que {room}. Décochez-la pour qu’elle reprenne son indépendance.': ['Tick a room to make it play the same thing as {room}. Untick it to let it play on its own again.', 'Отметьте комнату, чтобы она играла то же, что {room}. Снимите отметку, чтобы она снова играла отдельно.'],
  'Aucune autre enceinte de la maison ne peut se grouper avec celle-ci.': ['No other speaker in the house can be grouped with this one.', 'Ни одну другую колонку в доме нельзя объединить с этой.'],
  'Ce lecteur joue seul : il ne se groupe pas avec les enceintes.': ['This player plays alone: it cannot be grouped with the speakers.', 'Этот плеер играет отдельно: его нельзя объединить с колонками.'],
  'Autres lecteurs': ['Other players', 'Другие плееры'],
  'Choisir': ['Choose', 'Выбрать'],
  'Autres touches': ['More keys', 'Другие кнопки'],
} as const;

export const MEDIA_DE: Partial<Record<keyof typeof MEDIA, string>> = {
  'Parcourir': 'Entdecken', 'Groupes': 'Gruppen', 'Pièces et groupes': 'Räume und Gruppen', 'Volume du groupe': 'Gruppenlautstärke', 'Effacer la recherche': 'Suche löschen',
  'Ma musique': 'Meine Musik', 'Autres résultats': 'Weitere Ergebnisse', 'Ajout au groupe…': 'Wird zur Gruppe hinzugefügt…', 'Retrait du groupe…': 'Wird aus der Gruppe entfernt…',
  'Joue avec {room}': 'Spielt mit {room}', 'Dans un autre groupe : {group}': 'In einer anderen Gruppe: {group}', 'Joue autre chose : {title}': 'Spielt etwas anderes: {title}', 'Disponible': 'Verfügbar',
  '{n} pièces jouent ensemble': '{n} Räume spielen zusammen', 'Écoute en cours': 'Aktuelle Wiedergabe', 'Jouer partout': 'Überall abspielen', 'Tout séparer': 'Alle trennen',
  'Pièce principale du groupe': 'Hauptraum der Gruppe', 'Pièce écoutée': 'Ausgewählter Raum', 'Autres lecteurs': 'Weitere Player', 'Choisir': 'Auswählen', 'Autres touches': 'Weitere Tasten',
};
export const MEDIA_IT: Partial<Record<keyof typeof MEDIA, string>> = {
  'Parcourir': 'Sfoglia', 'Groupes': 'Gruppi', 'Pièces et groupes': 'Stanze e gruppi', 'Volume du groupe': 'Volume del gruppo', 'Effacer la recherche': 'Cancella la ricerca',
  'Ma musique': 'La mia musica', 'Autres résultats': 'Altri risultati', 'Ajout au groupe…': 'Aggiunta al gruppo…', 'Retrait du groupe…': 'Rimozione dal gruppo…',
  'Joue avec {room}': 'Suona con {room}', 'Dans un autre groupe : {group}': 'In un altro gruppo: {group}', 'Joue autre chose : {title}': 'Riproduce altro: {title}', 'Disponible': 'Disponibile',
  '{n} pièces jouent ensemble': '{n} stanze suonano insieme', 'Écoute en cours': 'In ascolto', 'Jouer partout': 'Riproduci ovunque', 'Tout séparer': 'Separa tutto',
  'Pièce principale du groupe': 'Stanza principale del gruppo', 'Pièce écoutée': 'Stanza in ascolto', 'Autres lecteurs': 'Altri lettori', 'Choisir': 'Scegli', 'Autres touches': 'Altri tasti',
};
