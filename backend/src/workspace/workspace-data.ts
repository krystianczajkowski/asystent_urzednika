import type {
  Department,
  KnowledgeBaseEntry,
  SampleDocument,
  WniosekCase,
} from './workspace.types.js';

export const departments: Department[] = [
  {
    id: 'wab',
    code: 'WAB',
    name: 'Wydział Administracji Budowlanej',
    isExternal: false,
    scope: 'Pozwolenia na budowę, projekty i dokumentacja budowlana.',
    contactEmail: 'wab@um.bydgoszcz.pl',
  },
  {
    id: 'wzigk',
    code: 'WZiGK',
    name: 'Wydział Zieleni i Gospodarki Komunalnej',
    isExternal: false,
    scope: 'Schronisko, zwierzęta, gospodarka odpadami i zieleń miejska.',
    contactEmail: 'wzigk@um.bydgoszcz.pl',
  },
  {
    id: 'weis',
    code: 'WEiS',
    name: 'Wydział Edukacji i Sportu',
    isExternal: false,
    scope: 'Szkoły, uczniowie, dotacje oświatowe i infrastruktura sportowa.',
    contactEmail: 'weis@um.bydgoszcz.pl',
  },
  {
    id: 'zdmikp',
    code: 'ZDMiKP',
    name: 'Zarząd Dróg Miejskich i Komunikacji Publicznej',
    isExternal: false,
    scope: 'Drogi publiczne, organizacja ruchu i komunikacja miejska.',
    contactEmail: 'zdmikp@zdmikp.bydgoszcz.pl',
  },
  {
    id: 'wso',
    code: 'WSO',
    name: 'Wydział Spraw Obywatelskich',
    isExternal: false,
    scope: 'Zezwolenia, ewidencja ludności i rejestry obywatelskie.',
    contactEmail: 'wso@um.bydgoszcz.pl',
  },
  {
    id: 'wzp',
    code: 'WZP',
    name: 'Wydział Zamówień Publicznych',
    isExternal: false,
    scope: 'Umowy, przetargi i zamówienia publiczne.',
    contactEmail: 'wzp@um.bydgoszcz.pl',
  },
  {
    id: 'bks',
    code: 'BKS',
    name: 'Biuro Komunikacji Społecznej',
    isExternal: false,
    scope: 'Koordynacja wniosków UDIP i redakcja pism urzędowych.',
    contactEmail: 'bks@um.bydgoszcz.pl',
  },
  {
    id: 'kpwkz',
    code: 'KPWKZ',
    name: 'Kujawsko-Pomorski Wojewódzki Konserwator Zabytków',
    isExternal: true,
    scope: 'Zabytki i nadzór konserwatorski; zewnętrzny dysponent danych.',
    contactEmail: 'bydgoszcz@torun.wkz.gov.pl',
    address: 'ul. Jezuicka 2, 85-102 Bydgoszcz',
  },
];

export const knowledgeBase: KnowledgeBaseEntry[] = [
  {
    id: 'kb-543-2026',
    type: 'archival_qa',
    caseNumber: 'BKS.IV.1431.543.2025',
    title: 'Opieka nad bezdomnymi zwierzętami i schronisko w Bydgoszczy',
    department: 'Wydział Zieleni i Gospodarki Komunalnej (WZiGK)',
    date: '2026-09-22',
    tags: ['zwierzęta', 'schronisko', 'budżet', 'WZiGK'],
    questionSummary: 'Liczba zwierząt, budżet schroniska i umowy z podmiotami.',
    answerText:
      'Opiekę nad bezdomnymi zwierzętami sprawuje Schronisko dla Zwierząt w Bydgoszczy. W 2025 r. zapewniono opiekę 839 psom i 560 kotom. Budżet schroniska wyniósł 3.143.761,14 zł.',
  },
  {
    id: 'kb-15-2026',
    type: 'archival_qa',
    caseNumber: 'BKS.IV.1431.15.2026',
    title: 'Rzeźba Ludmiły Stehnovej — właściwy dysponent informacji',
    department: 'Kujawsko-Pomorski Wojewódzki Konserwator Zabytków',
    date: '2026-01-14',
    tags: ['rzeźba', 'zabytek', 'redirect', 'KPWKZ'],
    questionSummary: 'Stan, lokalizacja i konserwacja rzeźby usuniętej z ronda.',
    answerText:
      'Urząd Miasta Bydgoszczy nie jest dysponentem wnioskowanych danych. Właściwym podmiotem jest Kujawsko-Pomorski Wojewódzki Konserwator Zabytków (art. 4 ust. 3 UDIP).',
  },
  {
    id: 'kb-509-2026',
    type: 'archival_qa',
    caseNumber: 'BKS.IV.1431.509.2026',
    title: 'Wezwanie do doprecyzowania — dokumentacja budowlana Astorii',
    department: 'Wydział Administracji Budowlanej (WAB)',
    date: '2026-08-10',
    tags: ['budownictwo', 'doprecyzowanie', 'WAB'],
    questionSummary: 'Prośba o wskazanie dokumentacji i akt sprawy.',
    answerText:
      'Wydział Administracji Budowlanej wnosi o doprecyzowanie wniosku i wskazanie, o jakie dokładnie akta sprawy chodzi. Dostęp do akt będzie możliwy po zakończeniu anonimizacji.',
  },
  {
    id: 'kb-307-2025',
    type: 'archival_qa',
    caseNumber: 'BKS.IV.1431.307.2025',
    title: 'Liczba uczniów i uczniów cudzoziemców w bydgoskich szkołach',
    department: 'Wydział Edukacji i Sportu (WEiS)',
    date: '2025-07-08',
    tags: ['edukacja', 'szkoły', 'uczniowie', 'WEiS'],
    questionSummary: 'Zestawienie liczby uczniów i cudzoziemców w szkołach.',
    answerText:
      'Wydział Edukacji i Sportu przekazuje zestawienie zbiorcze z podziałem na placówki prowadzone przez Miasto Bydgoszcz, opracowane na podstawie danych SIO.',
  },
  {
    id: 'kb-law-udip',
    type: 'legal_act',
    caseNumber: 'Dz.U. 2022 poz. 902',
    title: 'Ustawa o dostępie do informacji publicznej (UDIP)',
    department: 'Podstawa prawna ogólnourzędowa',
    date: '2025-10-01',
    tags: ['UDIP', 'art. 4', 'art. 13', 'termin 14 dni'],
    questionSummary: 'Terminy i obowiązki przy rozpatrywaniu wniosków UDIP.',
    answerText:
      'Art. 13 ust. 1 UDIP: informacja jest udostępniana bez zbędnej zwłoki, nie później niż w terminie 14 dni. Art. 13 ust. 2 określa zasady powiadomienia o opóźnieniu.',
  },
  {
    id: 'kb-law-kpa',
    type: 'legal_act',
    caseNumber: 'Dz.U. 2024 poz. 572',
    title: 'Kodeks postępowania administracyjnego (KPA)',
    department: 'Podstawa prawna ogólnourzędowa',
    date: '2025-01-01',
    tags: ['KPA', 'art. 64', 'braki formalne'],
    questionSummary: 'Uzupełnianie braków i doprecyzowanie podania.',
    answerText:
      'Art. 64 § 2 KPA: w przypadku braków podania organ wzywa do ich usunięcia w wyznaczonym terminie, z pouczeniem o skutkach jego niedochowania.',
  },
];

export const sampleDocuments: SampleDocument[] = [
  {
    id: 'sample-schronisko',
    label: 'Schronisko i opieka nad zwierzętami',
    fileName: 'wniosek_schronisko_2026.txt',
    description: 'Przykładowy wniosek podobny do sprawy z archiwum WZiGK.',
    content:
      'Wniosek o udostępnienie informacji publicznej: proszę o liczbę bezdomnych psów i kotów przyjętych w 2025 r., budżet schroniska oraz informacje o umowach z zewnętrznymi firmami.',
  },
  {
    id: 'sample-schools',
    label: 'Zestawienie uczniów w szkołach',
    fileName: 'wniosek_szkoly_2026.txt',
    description: 'Przykładowy wniosek dotyczący edukacji i uczniów.',
    content:
      'Proszę o udostępnienie aktualnego zestawienia liczby uczniów oraz uczniów cudzoziemców w poszczególnych szkołach podstawowych w Bydgoszczy.',
  },
  {
    id: 'sample-redirect',
    label: 'Rzeźba i konserwator zabytków',
    fileName: 'wniosek_zabytek_2026.txt',
    description: 'Przykładowy wniosek poza właściwością miasta.',
    content:
      'Proszę o informację o miejscu składowania rzeźby Ludmiły Stehnovej i harmonogramie prac konserwatorskich nadzorowanych przez Wojewódzkiego Konserwatora Zabytków.',
  },
];

const caseRows: Array<
  [
    string,
    string,
    string,
    string,
    string | null,
    WniosekCase['status'],
    string,
  ]
> = [
  ['Antoni Ptak Stowarzyszenie Obrony Zwierzątek', 'Opieka i odławianie bezdomnych zwierząt.', '2025-06-12', '2025-06-26', '2025-06-26', 'wyslana', 'wzigk'],
  ['Ewa Góra', 'Aktualne zestawienie liczby uczniów w szkołach podstawowych.', '2025-06-25', '2025-07-09', '2025-07-08', 'wyslana', 'weis'],
  ['Jacek Rzeźbiarz', 'Zapytanie o rzeźbę Ludmiły Stehnovej.', '2026-09-12', '2026-09-26', '2026-01-14', 'wyslana', 'kpwkz'],
  ['Jerzy Dociekliwy', 'Liczba punktów sprzedaży alkoholu.', '2026-01-09', '2026-01-23', '2026-01-20', 'wyslana', 'wso'],
  ['Redakcja Lokalna', 'Informacja o realizacji umowy nr 102/TT/2019.', '2026-01-14', '2026-01-28', '2026-01-15', 'wyslana', 'wzp'],
  ['Ksiądz', 'Liczba mieszkańców według opłat za odpady.', '2026-01-15', '2026-01-29', '2026-01-26', 'wyslana', 'wzigk'],
  ['Ewa Górna', 'Dokumentacja dotycząca basenu Astorii.', '2026-08-05', '2026-09-18', null, 'doprecyzowanie', 'wab'],
  ['Stowarzyszenie Obrony Zwierzątek', 'Opieka nad bezdomnymi zwierzętami.', '2026-08-14', '2026-08-28', null, 'przygotowana', 'wzigk'],
  ['Budowlanka S.A.', 'Kompleks Astoria.', '2026-09-07', '2026-09-21', null, 'zapytania_wyslane', 'wab'],
  ['Ewa Góra', 'Zestawienie uczniów i uczniów cudzoziemców.', '2026-09-08', '2026-09-22', null, 'kwerenda', 'weis'],
];

export const cases: WniosekCase[] = caseRows.map((row, index) => {
  const lp = index + 1;
  const number = ['293.2025', '307.2025', '15.2026', '16.2026', '17.2026', '18.2026', '509.2026', '543.2026', '590.2026', '599.2026'][index];
  const caseNumber = `BKS.IV.1431.${number}`;
  const archive = knowledgeBase.find((entry) => entry.caseNumber.endsWith(number));
  return {
    id: `case-${lp}`,
    lp,
    caseNumber,
    applicant: row[0],
    subject: row[1],
    fullRequestText: `Wniosek o udostępnienie informacji publicznej (${caseNumber})\nWnioskodawca: ${row[0]}\n\nPrzedmiot zapytania:\n${row[1]}`,
    receivedDate: row[2],
    dueDate: row[3],
    responseDate: row[4],
    assignee: lp % 2 === 0 ? 'Pracownik 2' : 'Pracownik 1',
    status: row[5],
    kwerendaDays: row[5] === 'kwerenda' ? 14 : 0,
    tags: archive?.tags ?? ['UDIP'],
    summary: row[1],
    recommendedDepartmentId: row[6],
    departmentReplyText: '',
    draftResponseText: archive?.answerText ?? '',
    savedToKnowledgeBase: Boolean(archive),
    analysis: null,
  };
});

export const anonymizationRules = [
  'Imię i nazwisko osoby fizycznej niepełniącej funkcji publicznej',
  'Numer PESEL i dokumentu tożsamości',
  'Adres zamieszkania oraz prywatny telefon i e-mail',
  'Numer rachunku bankowego',
  'Dane o zdrowiu, sytuacji rodzinnej i majątkowej',
  'Numer księgi wieczystej lub działki identyfikujący osobę prywatną',
  'Numer rejestracyjny pojazdu prywatnego',
  'Tajemnica przedsiębiorstwa i tajemnice ustawowo chronione',
];
