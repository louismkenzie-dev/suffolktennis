/**
 * Player photo library.
 *
 * Every image is a Creative Commons file from Wikimedia Commons, copied into
 * our own `player-photos` storage bucket — Wikimedia blocks hotlinking, which
 * is why the galleries used to come up empty. The CC licences require the
 * photographer to be credited, so each entry carries its author, licence and
 * a link back to the Commons file page; the modal renders that line.
 */
export interface PlayerPhoto {
  /** Public URL in our own storage bucket. */
  url: string;
  /** Photographer, as named on Commons. */
  credit: string;
  /** Licence short name, e.g. "CC BY-SA 4.0". */
  licence: string;
  /** Commons file page, so a viewer can reach the full licence terms. */
  source: string;
}

const BUCKET =
  "https://twtmkvorzpvwnznqzcrw.supabase.co/storage/v1/object/public/player-photos";

/** Keyed by the player's slug — see `slug` on each entry in BritishPlayerWatch. */
export const PLAYER_PHOTOS: Record<string, PlayerPhoto[]> = {
  "alfie-hewett": [
    { url: `${BUCKET}/alfie-hewett/1.jpg`, credit: "Carine06 from UK", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Alfie_Hewett_(50497971823).jpg" },
    { url: `${BUCKET}/alfie-hewett/2.jpg`, credit: "Hameltion", licence: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Alfie_Hewett_(2023_French_Open)_01.jpg" },
    { url: `${BUCKET}/alfie-hewett/3.jpg`, credit: "Carine06 from UK", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Alfie_Hewett_(50498833462).jpg" },
    { url: `${BUCKET}/alfie-hewett/4.jpg`, credit: "Carine06 from UK", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Alfie_Hewett_(35580720080).jpg" },
  ],
  "andy-murray": [
    { url: `${BUCKET}/andy-murray/b1.jpg`, credit: "Christopher Johnson", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Andy_Murray_Racket.jpg" },
    { url: `${BUCKET}/andy-murray/b2.jpg`, credit: "Carine06 from UK", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Andy_Murray_(44087043305).jpg" },
    { url: `${BUCKET}/andy-murray/b3.jpg`, credit: "Carine06 from UK", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Andy_Murray_(39989219663).jpg" },
    { url: `${BUCKET}/andy-murray/b4.jpg`, credit: "johnwnguyen", licence: "CC BY 2.0", source: "https://commons.wikimedia.org/wiki/File:Andy_Murray_Forehand.jpg" },
    { url: `${BUCKET}/andy-murray/b5.jpg`, credit: "Carine06 from UK", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Andy_Murray_(46986929091).jpg" },
  ],
  "arthur-fery": [
    { url: `${BUCKET}/arthur-fery/1.jpg`, credit: "si.robi", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Fery_WMQ22_(13)_(52191184348).jpg" },
  ],
  "cameron-norrie": [
    { url: `${BUCKET}/cameron-norrie/1.jpg`, credit: "si.robi", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Norrie_WM17_(2)_(36143094896).jpg" },
    { url: `${BUCKET}/cameron-norrie/2.jpg`, credit: "si.robi", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Norrie_RG21_(4)_(51375330282).jpg" },
    { url: `${BUCKET}/cameron-norrie/3.jpg`, credit: "si.robi", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Cameron_Norrie_Eastbourne_2017.jpg" },
    { url: `${BUCKET}/cameron-norrie/4.jpg`, credit: "Hameltion", licence: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Cam_Norrie_(2023_US_Open)_01.jpg" },
  ],
  "emma-raducanu": [
    { url: `${BUCKET}/emma-raducanu/b1.jpg`, credit: "Vbrunophotog", licence: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Emma_Raducanu_at_2025_Miami_Open_02_(cropped).jpg" },
    { url: `${BUCKET}/emma-raducanu/b2.jpg`, credit: "Hameltion", licence: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Emma_Raducanu_(2024_DC_Open)_03.jpg" },
    { url: `${BUCKET}/emma-raducanu/1.jpg`, credit: "Chris Czermak", licence: "CC BY 2.0", source: "https://commons.wikimedia.org/wiki/File:Emma_Raducanu.jpg" },
    { url: `${BUCKET}/emma-raducanu/3.jpg`, credit: "Vbrunophotog", licence: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Emma_Raducanu_at_2025_Miami_Open_05.jpg" },
    { url: `${BUCKET}/emma-raducanu/b3.jpg`, credit: "Hameltion", licence: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Emma_Raducanu_(2024_DC_Open)_01_(cropped).jpg" },
  ],
  "gordon-reid": [
    { url: `${BUCKET}/gordon-reid/1.jpg`, credit: "Edwin Martinez", licence: "CC BY 2.0", source: "https://commons.wikimedia.org/wiki/File:Gordon_Reid_(9705480310).jpg" },
    { url: `${BUCKET}/gordon-reid/2.jpg`, credit: "Edwin Martinez", licence: "CC BY 2.0", source: "https://commons.wikimedia.org/wiki/File:Gordon_Reid_(9702248953).jpg" },
    { url: `${BUCKET}/gordon-reid/3.jpg`, credit: "Edwin Martinez", licence: "CC BY 2.0", source: "https://commons.wikimedia.org/wiki/File:Gordon_Reid_(9702252351).jpg" },
    { url: `${BUCKET}/gordon-reid/4.jpg`, credit: "Edwin Martinez", licence: "CC BY 2.0", source: "https://commons.wikimedia.org/wiki/File:Gordon_Reid_(9705488970).jpg" },
  ],
  "greg-rusedski": [
    { url: `${BUCKET}/greg-rusedski/1.jpg`, credit: "Andrew Campbell", licence: "CC BY 2.0", source: "https://commons.wikimedia.org/wiki/File:Greg_Rusedski_(14253590549).jpg" },
    { url: `${BUCKET}/greg-rusedski/3.jpg`, credit: "Charlie Cowins", licence: "CC BY 2.0", source: "https://commons.wikimedia.org/wiki/File:Greg_Rusedski_2011.jpg" },
  ],
  "harriet-dart": [
    { url: `${BUCKET}/harriet-dart/1.jpg`, credit: "si.robi", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Dart_WM19_(9)_(48521880041).jpg" },
    { url: `${BUCKET}/harriet-dart/2.jpg`, credit: "si.robi", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Dart_WMQ16_(7)_(28133895771).jpg" },
    { url: `${BUCKET}/harriet-dart/3.jpg`, credit: "Andrew Campbell", licence: "CC BY 2.0", source: "https://commons.wikimedia.org/wiki/File:Harriet_Dart_(35366066442).jpg" },
    { url: `${BUCKET}/harriet-dart/4.jpg`, credit: "si.robi", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Dart_RGQ23.jpg" },
  ],
  "henry-patten": [
    { url: `${BUCKET}/henry-patten/1.jpg`, credit: "Hameltion", licence: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Henry_Patten_(2023_Cary)_02_(cropped).jpg" },
    { url: `${BUCKET}/henry-patten/3.jpg`, credit: "Hameltion", licence: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Henry_Patten_(2023_Cary)_03.jpg" },
    { url: `${BUCKET}/henry-patten/4.jpg`, credit: "Hameltion", licence: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Henry_Patten_(2023_Cary)_05.jpg" },
  ],
  "jack-draper": [
    { url: `${BUCKET}/jack-draper/1.jpg`, credit: "si.robi", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Draper_MCM23_(55)_(52883527225).jpg" },
    { url: `${BUCKET}/jack-draper/2.jpg`, credit: "Carine06 from UK", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Jack_Draper_(50088332011).jpg" },
  ],
  "joe-salisbury": [
    { url: `${BUCKET}/joe-salisbury/1.jpg`, credit: "si.robi", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Salisbury_WMQ16_(4)_(27595810773).jpg" },
    { url: `${BUCKET}/joe-salisbury/2.jpg`, credit: "si.robi", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Salisbury_PM19_(27)_(49307391583).jpg" },
    { url: `${BUCKET}/joe-salisbury/3.jpg`, credit: "si.robi", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Salisbury_RG22_(1)_(52144292229).jpg" },
    { url: `${BUCKET}/joe-salisbury/4.jpg`, credit: "Carine06 from UK", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Joe_Salisbury_(43772857140).jpg" },
  ],
  "katie-boulter": [
    { url: `${BUCKET}/katie-boulter/1.jpg`, credit: "Chris Czermak", licence: "CC BY 2.0", source: "https://commons.wikimedia.org/wiki/File:Katie_Boulter_Return_of_Serve_(cropped).jpg" },
    { url: `${BUCKET}/katie-boulter/3.jpg`, credit: "Carine06 from UK", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Katie_Boulter_(28911852098).jpg" },
    { url: `${BUCKET}/katie-boulter/4.jpg`, credit: "Steven Pisano", licence: "CC BY 2.0", source: "https://commons.wikimedia.org/wiki/File:2017_US_Open_Tennis_-_Qualifying_Rounds_-_Katie_Boulter_(GBR)_def._Danka_Kovinic_(MNE)_(3)_(37088876795).jpg" },
  ],
  "neal-skupski": [
    { url: `${BUCKET}/neal-skupski/1.jpg`, credit: "si.robi", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Skupski_N._RG19_(12)_(48199059472).jpg" },
    { url: `${BUCKET}/neal-skupski/2.jpg`, credit: "si.robi", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Skupski_N._WM17_(21)_(35347278064).jpg" },
    { url: `${BUCKET}/neal-skupski/3.jpg`, credit: "si.robi", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Skupski_N._WM16_(9)_(27802523213).jpg" },
    { url: `${BUCKET}/neal-skupski/4.jpg`, credit: "si.robi", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Skupski_MCM23_(52882568957).jpg" },
  ],
  "tim-henman": [
    { url: `${BUCKET}/tim-henman/1.jpg`, credit: "pfctdayelise", licence: "CC BY-SA 2.5", source: "https://commons.wikimedia.org/wiki/File:Tim_Henman_2006_Australian_Open.JPG" },
    { url: `${BUCKET}/tim-henman/b1.jpg`, credit: "Wikimedia Commons", licence: "CC BY 2.0", source: "https://commons.wikimedia.org/wiki/File:Tim_Henman_backhand_volley_Wimbledon_2004.jpg" },
    { url: `${BUCKET}/tim-henman/4.jpg`, credit: "Lijian Zhang", licence: "CC BY-SA 2.0", source: "https://commons.wikimedia.org/wiki/File:Tim_Henman_2007.jpg" },
    { url: `${BUCKET}/tim-henman/b2.jpg`, credit: "Alexisrael", licence: "CC BY-SA 3.0", source: "https://commons.wikimedia.org/wiki/File:Tim_Henman_1.jpg" },
  ],
  "virginia-wade": [
    { url: `${BUCKET}/virginia-wade/b1.jpg`, credit: "UKinUSA", licence: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Virginia_Wade_2026.jpg" },
  ],
};

/** Gallery for a player, or an empty list when we have no cleared photos. */
export function photosFor(slug: string): PlayerPhoto[] {
  return PLAYER_PHOTOS[slug] ?? [];
}
