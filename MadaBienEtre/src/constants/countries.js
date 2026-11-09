// src/constants/countries.js
// ============================================================
// Pays pour la saisie des numéros de téléphone internationaux.
// Format de chaque ligne : "ISO|Nom (français)|indicatif"
// Madagascar est le pays par défaut (affiché en premier), suivi des
// pays les plus fréquents pour les clients de Mada Bien-être.
// ============================================================

export const DEFAULT_COUNTRY_ISO = 'MG';

// Affichés en haut de la liste (dans cet ordre)
const PRIORITY = ['MG', 'FR', 'RE', 'YT', 'MU', 'KM', 'SC', 'CH', 'BE', 'CA', 'US', 'GB', 'DE', 'IT', 'ES', 'CN', 'IN'];

const RAW = `
AF|Afghanistan|93
ZA|Afrique du Sud|27
AL|Albanie|355
DZ|Algérie|213
DE|Allemagne|49
AD|Andorre|376
AO|Angola|244
AI|Anguilla|1264
AG|Antigua-et-Barbuda|1268
SA|Arabie saoudite|966
AR|Argentine|54
AM|Arménie|374
AW|Aruba|297
AU|Australie|61
AT|Autriche|43
AZ|Azerbaïdjan|994
BS|Bahamas|1242
BH|Bahreïn|973
BD|Bangladesh|880
BB|Barbade|1246
BE|Belgique|32
BZ|Belize|501
BJ|Bénin|229
BM|Bermudes|1441
BT|Bhoutan|975
BY|Biélorussie|375
MM|Birmanie (Myanmar)|95
BO|Bolivie|591
BA|Bosnie-Herzégovine|387
BW|Botswana|267
BR|Brésil|55
BN|Brunéi|673
BG|Bulgarie|359
BF|Burkina Faso|226
BI|Burundi|257
KH|Cambodge|855
CM|Cameroun|237
CA|Canada|1
CV|Cap-Vert|238
CL|Chili|56
CN|Chine|86
CY|Chypre|357
CO|Colombie|57
KM|Comores|269
CG|Congo-Brazzaville|242
CD|Congo-Kinshasa (RDC)|243
KR|Corée du Sud|82
KP|Corée du Nord|850
CR|Costa Rica|506
CI|Côte d'Ivoire|225
HR|Croatie|385
CU|Cuba|53
CW|Curaçao|599
DK|Danemark|45
DJ|Djibouti|253
DM|Dominique|1767
EG|Égypte|20
AE|Émirats arabes unis|971
EC|Équateur|593
ER|Érythrée|291
ES|Espagne|34
EE|Estonie|372
SZ|Eswatini|268
US|États-Unis|1
ET|Éthiopie|251
FJ|Fidji|679
FI|Finlande|358
FR|France|33
GA|Gabon|241
GM|Gambie|220
GE|Géorgie|995
GH|Ghana|233
GI|Gibraltar|350
GR|Grèce|30
GD|Grenade|1473
GL|Groenland|299
GP|Guadeloupe|590
GU|Guam|1671
GT|Guatemala|502
GN|Guinée|224
GQ|Guinée équatoriale|240
GW|Guinée-Bissau|245
GY|Guyana|592
GF|Guyane française|594
HT|Haïti|509
HN|Honduras|504
HK|Hong Kong|852
HU|Hongrie|36
KY|Îles Caïmans|1345
CK|Îles Cook|682
FO|Îles Féroé|298
VG|Îles Vierges britanniques|1284
VI|Îles Vierges américaines|1340
IN|Inde|91
ID|Indonésie|62
IQ|Irak|964
IR|Iran|98
IE|Irlande|353
IS|Islande|354
IL|Israël|972
IT|Italie|39
JM|Jamaïque|1876
JP|Japon|81
JO|Jordanie|962
KZ|Kazakhstan|7
KE|Kenya|254
KG|Kirghizistan|996
KI|Kiribati|686
XK|Kosovo|383
KW|Koweït|965
LA|Laos|856
LS|Lesotho|266
LV|Lettonie|371
LB|Liban|961
LR|Libéria|231
LY|Libye|218
LI|Liechtenstein|423
LT|Lituanie|370
LU|Luxembourg|352
MO|Macao|853
MK|Macédoine du Nord|389
MG|Madagascar|261
MY|Malaisie|60
MW|Malawi|265
MV|Maldives|960
ML|Mali|223
MT|Malte|356
MA|Maroc|212
MQ|Martinique|596
MU|Maurice|230
MR|Mauritanie|222
YT|Mayotte|262
MX|Mexique|52
MD|Moldavie|373
MC|Monaco|377
MN|Mongolie|976
ME|Monténégro|382
MS|Montserrat|1664
MZ|Mozambique|258
NA|Namibie|264
NR|Nauru|674
NP|Népal|977
NI|Nicaragua|505
NE|Niger|227
NG|Nigéria|234
NO|Norvège|47
NC|Nouvelle-Calédonie|687
NZ|Nouvelle-Zélande|64
OM|Oman|968
UG|Ouganda|256
UZ|Ouzbékistan|998
PK|Pakistan|92
PW|Palaos|680
PS|Palestine|970
PA|Panama|507
PG|Papouasie-Nouvelle-Guinée|675
PY|Paraguay|595
NL|Pays-Bas|31
PE|Pérou|51
PH|Philippines|63
PL|Pologne|48
PF|Polynésie française|689
PR|Porto Rico|1787
PT|Portugal|351
QA|Qatar|974
CF|République centrafricaine|236
DO|République dominicaine|1809
CZ|République tchèque|420
RE|La Réunion|262
RO|Roumanie|40
GB|Royaume-Uni|44
RU|Russie|7
RW|Rwanda|250
KN|Saint-Christophe-et-Niévès|1869
SM|Saint-Marin|378
VC|Saint-Vincent-et-les-Grenadines|1784
LC|Sainte-Lucie|1758
SV|Salvador|503
WS|Samoa|685
ST|Sao Tomé-et-Principe|239
SN|Sénégal|221
RS|Serbie|381
SC|Seychelles|248
SL|Sierra Leone|232
SG|Singapour|65
SK|Slovaquie|421
SI|Slovénie|386
SO|Somalie|252
SD|Soudan|249
SS|Soudan du Sud|211
LK|Sri Lanka|94
SE|Suède|46
CH|Suisse|41
SR|Suriname|597
SY|Syrie|963
TJ|Tadjikistan|992
TW|Taïwan|886
TZ|Tanzanie|255
TD|Tchad|235
TH|Thaïlande|66
TL|Timor oriental|670
TG|Togo|228
TO|Tonga|676
TT|Trinité-et-Tobago|1868
TN|Tunisie|216
TM|Turkménistan|993
TR|Turquie|90
UA|Ukraine|380
UY|Uruguay|598
VU|Vanuatu|678
VA|Vatican|379
VE|Venezuela|58
VN|Viêt Nam|84
YE|Yémen|967
ZM|Zambie|260
ZW|Zimbabwe|263
`;

const ALL = RAW.trim()
  .split('\n')
  .map((line) => {
    const [iso, name, dial] = line.split('|');
    return { iso, name, dial };
  });

// Madagascar, France, … en tête ; le reste par ordre alphabétique (déjà trié ci-dessus)
export const COUNTRIES = [
  ...PRIORITY.map((iso) => ALL.find((c) => c.iso === iso)).filter(Boolean),
  ...ALL.filter((c) => !PRIORITY.includes(c.iso)),
];

export const getCountry = (iso) => ALL.find((c) => c.iso === iso) || null;

// Indicatif partagé par plusieurs pays → pays choisi par défaut quand on colle « +1… », « +7… »
const DIAL_PREFERRED = { '1': 'US', '7': 'RU', '262': 'RE', '44': 'GB', '47': 'NO', '61': 'AU', '212': 'MA', '590': 'GP', '599': 'CW', '358': 'FI' };

const DIALS_DESC = [...new Set(ALL.map((c) => c.dial))].sort((a, b) => b.length - a.length);

/** « +33612345678 » -> { country, national: '612345678' } (ou null si indicatif inconnu). */
export const findCountryByE164 = (e164) => {
  const digits = String(e164 || '').replace(/\D/g, '');
  if (!digits) return null;
  for (const dial of DIALS_DESC) {
    if (digits.startsWith(dial)) {
      const iso = DIAL_PREFERRED[dial] || ALL.find((c) => c.dial === dial).iso;
      return { country: getCountry(iso), national: digits.slice(dial.length) };
    }
  }
  return null;
};

// Longueurs du numéro national (sans indicatif ni 0 initial) quand elles sont connues
export const NATIONAL_LENGTH = {
  MG: [9, 9],
  FR: [9, 9],
  RE: [9, 9],
  YT: [9, 9],
  MU: [7, 8],
  KM: [7, 7],
  SC: [7, 7],
  US: [10, 10],
  CA: [10, 10],
  GB: [10, 10],
  DE: [10, 11],
  IT: [9, 10],
  ES: [9, 9],
  BE: [8, 9],
  CH: [9, 9],
  CN: [11, 11],
  IN: [10, 10],
};

// Groupes d'affichage (masque) : MG -> « 34 12 345 67 »
export const MASK_GROUPS = {
  MG: [2, 2, 3, 2],
  FR: [1, 2, 2, 2, 2],
  RE: [3, 2, 2, 2],
  YT: [3, 2, 2, 2],
  US: [3, 3, 4],
  CA: [3, 3, 4],
  GB: [4, 6],
  DE: [3, 4, 4],
  IT: [3, 3, 4],
  ES: [3, 3, 3],
  BE: [3, 2, 2, 2],
  CH: [2, 3, 2, 2],
  CN: [3, 4, 4],
  IN: [5, 5],
  MU: [4, 4],
};

// Pays où le 0 initial fait partie du numéro (ne pas le retirer)
export const KEEP_LEADING_ZERO = ['IT', 'SM', 'VA'];
