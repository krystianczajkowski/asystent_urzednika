import express from "express";
import fs from "node:fs";
import path from "node:path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = process.cwd();

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Brak klucza GEMINI_API_KEY po stronie serwera. Skonfiguruj klucz w Settings > Secrets."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeUsOrPlDate(raw: string, fallback = "2026-09-18"): string {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  // Handle M/D/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, "0");
    const day = slashMatch[2].padStart(2, "0");
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Handle DD.MM.YYYY (e.g., take latest date if range like "19.08.2026/18.09.2026 - doprecyzowanie wniosku")
  const dotMatches = [...trimmed.matchAll(/(\d{2})\.(\d{2})\.(\d{4})/g)];
  if (dotMatches.length > 0) {
    const last = dotMatches[dotMatches.length - 1];
    return `${last[3]}-${last[2]}-${last[1]}`;
  }

  return fallback;
}

const DEPARTMENTS = [
  {
    id: "wab",
    code: "WAB",
    name: "Wydział Administracji Budowlanej",
    isExternal: false,
    scope:
      "Pozwolenia na budowę, projekty budowlane, dokumentacja obiektów (np. Astoria, Astrum), decyzje o warunkach zabudowy, zagospodarowanie terenu.",
    contactEmail: "wab@um.bydgoszcz.pl",
  },
  {
    id: "wzigk",
    code: "WZiGK",
    name: "Wydział Zieleni i Gospodarki Komunalnej",
    isExternal: false,
    scope:
      "Ochrona zwierząt i Schronisko dla Zwierząt, gospodarka odpadami komunalnymi, liczba mieszkańców wg deklaracji śmieciowych, zieleń miejska.",
    contactEmail: "wzigk@um.bydgoszcz.pl",
  },
  {
    id: "weis",
    code: "WEiS",
    name: "Wydział Edukacji i Sportu",
    isExternal: false,
    scope:
      "Szkoły podstawowe i ponadpodstawowe, liczba uczniów, uczniowie cudzoziemcy, dotacje oświatowe, infrastruktura sportowa.",
    contactEmail: "weis@um.bydgoszcz.pl",
  },
  {
    id: "zdmikp",
    code: "ZDMiKP",
    name: "Zarząd Dróg Miejskich i Komunikacji Publicznej",
    isExternal: false,
    scope:
      "Drogi publiczne, drogi dojazdowe, organizacja ruchu, przebudowa bulwarów i nabrzeży w pasie drogowym, komunikacja miejska.",
    contactEmail: "zdmikp@zdmikp.bydgoszcz.pl",
  },
  {
    id: "wso",
    code: "WSO",
    name: "Wydział Spraw Obywatelskich / Zezwolenia",
    isExternal: false,
    scope:
      "Zezwolenia na sprzedaż napojów alkoholowych, liczba punktów sprzedaży alkoholu, ewidencja ludności, rejestry obywatelskie.",
    contactEmail: "wso@um.bydgoszcz.pl",
  },
  {
    id: "wzp",
    code: "WZP",
    name: "Wydział Zamówień Publicznych / Inwestycje",
    isExternal: false,
    scope:
      "Umowy z podmiotami zewnętrznymi, przetargi, zamówienia publiczne, realizacja kontraktów miejskich i faktury.",
    contactEmail: "wzp@um.bydgoszcz.pl",
  },
  {
    id: "bks",
    code: "BKS",
    name: "Biuro Komunikacji Społecznej",
    isExternal: false,
    scope:
      "Koordynacja wniosków UDIP, redakcja pism urzędowych, wezwania do doprecyzowania, przedłużenia terminów (art. 13 ust. 2 UDIP).",
    contactEmail: "bks@um.bydgoszcz.pl",
  },
  {
    id: "kpwkz",
    code: "KPWKZ (Zewnętrzny)",
    name: "Kujawsko-Pomorski Wojewódzki Konserwator Zabytków (Delegatura w Bydgoszczy)",
    isExternal: true,
    scope:
      "Zabytki nieruchome i ruchome, rzeźby (np. rzeźba Ludmiły Stehnovej), nadzór konserwatorski — UMB nie jest dysponentem (art. 4 ust. 3 UDIP).",
    contactEmail: "bydgoszcz@torun.wkz.gov.pl",
    address: "ul. Jezuicka 2, 85-102 BYDGOSZCZ",
    phone: "(+48 0 52) 322 44 17, 322 49 98",
  },
];

const KNOWLEDGE_BASE = [
  {
    id: "kb-543-2026",
    type: "archival_qa",
    caseNumber: "BKS.IV.1431.543.2025",
    title:
      "Opieka nad bezdomnymi zwierzętami i ich wyłapywanie — Schronisko dla Zwierząt w Bydgoszczy",
    department: "Wydział Zieleni i Gospodarki Komunalnej (WZiGK)",
    date: "2026-09-22",
    tags: ["zwierzęta", "schronisko", "budżet", "umowy", "WZiGK"],
    questionSummary:
      "Sposób i skutki wykonywania zadania opieka nad bezdomnymi zwierzętami, liczba zwierząt, budżet oraz umowy z podmiotami zewnętrznymi.",
    answerText: `Ad 1
Opiekę nad domowymi zwierzętami bezdomnymi sprawuje Schronisko dla Zwierząt w Bydgoszczy, które jest jednostką budżetową Miasta Bydgoszczy. Z uwagi na powyższe Miasto nie zawierało umów z podmiotami zewnętrznymi w zakresie opieki nad domowymi zwierzętami bezdomnymi.
Ad 2
Opiekę nad zwierzętami bezdomnymi sprawuje Schronisko dla Zwierząt w Bydgoszczy.
Ad 3
Schronisko zapewniło opiekę w 2025 r. 839 psom oraz 560 kotom.
Ad 4
Budżet schroniska w 2025 r. wyniósł 3.143.761,14 zł.
Ad 5
Informuję, że w 2025 r. w zakresie zapewnienia opieki bezdomnym zwierzętom realizowana była Umowa 1/2022/SZ zawarta między Schroniskiem dla Zwierząt w Bydgoszczy a Kliniką Weterynaryjną.`,
  },
  {
    id: "kb-15-2026",
    type: "archival_qa",
    caseNumber: "BKS.IV.1431.15.2026",
    title:
      "Stan i lokalizacja przechowywania rzeźby Ludmiły Stehnovej — wskazanie właściwego dysponenta",
    department: "Kujawsko-Pomorski Wojewódzki Konserwator Zabytków",
    date: "2026-01-14",
    tags: ["rzeźba", "zabytek", "przekierowanie", "art. 4 ust. 3 UDIP", "KPWKZ"],
    questionSummary:
      "Zapytanie o aktualny stan i lokalizację przechowywania rzeźby Ludmiły Stehnovej usuniętej z Ronda Grunwaldzkiego.",
    answerText: `W odpowiedzi na wystosowany wniosek o udostępnienie informacji publicznej dotyczący aktualnego stanu i lokalizacji przechowywania rzeźby Ludmiły Stehnovej, uprzejmie informuję iż Urząd Miasta Bydgoszczy nie jest dysponentem wnioskowanych danych.
Jednocześnie wskazuję, iż zgodnie z zasadą dostępu do informacji publicznej, wyrażoną w art. 4 ust. 3 ustawy z dnia 6 września 2001 r. o dostępie do informacji publicznej (t.j. Dz. U. z 2022 r. poz. 902) obowiązane do udostępnienia informacji publicznej są podmioty publiczne będące w posiadaniu tych informacji.
Wnioskodawca winien się zwrócić do Kujawsko-Pomorskiego Wojewódzkiego Konserwatora Zabytków (Delegatura w Bydgoszczy, ul. Jezuicka 2, 85-102 BYDGOSZCZ, tel. (+48 0 52) 322 44 17, e-mail: bydgoszcz@torun.wkz.gov.pl) jako właściwego dysponenta danych.`,
  },
  {
    id: "kb-509-2026",
    type: "archival_qa",
    caseNumber: "BKS.IV.1431.509.2026",
    title:
      "Wezwanie do doprecyzowania wniosku — dokumentacja budowlana apartamentowca / basenu (Astrum / Astoria)",
    department: "Wydział Administracji Budowlanej (WAB)",
    date: "2026-08-10",
    tags: ["budownictwo", "doprecyzowanie", "anonimizacja", "WAB", "art. 13 ust. 2"],
    questionSummary:
      "Udostępnienie projektu zagospodarowania terenu, zieleni, wizualizacji, parametrów technicznych oraz przebudowy bulwarów i drogi dojazdowej.",
    answerText: `Komórka merytoryczna, tj. Wydział Administracji Budowlanej Urzędu Miasta Bydgoszczy wnosi o doprecyzowanie wniosku odnośnie udostępnienia dokumentacji budowlanej i wskazanie przez Wnioskodawcę, o jakie dokładnie akta sprawy chodzi.
Jednocześnie informuję, że dostęp do pierwotnego projektu budowlanego jest możliwy wyłącznie na miejscu, ponieważ projekty są trwale spięte, co uniemożliwia dokonanie ich kopii czy skanów. Dostęp do akt sprawy będzie możliwy po zakończeniu procesu anonimizacji.
Proszę o przesłanie doprecyzowania w terminie 7 dni od otrzymania niniejszego pisma. Jednocześnie stosownie do treści art. 13 ust. 2 ustawy z 06.09.2001 r. o dostępie do informacji publicznej wyznaczam nowy termin na rozpatrzenie wniosku.`,
  },
  {
    id: "kb-307-2025",
    type: "archival_qa",
    caseNumber: "BKS.IV.1431.307.2025",
    title:
      "Liczba uczniów oraz uczniów cudzoziemców w bydgoskich szkołach podstawowych",
    department: "Wydział Edukacji i Sportu (WEiS)",
    date: "2025-07-08",
    tags: ["edukacja", "szkoły", "uczniowie", "cudzoziemcy", "WEiS"],
    questionSummary:
      "Aktualne zestawienie liczby uczniów i obcokrajowców w poszczególnych szkołach podstawowych w Bydgoszczy.",
    answerText:
      "Wydział Edukacji i Sportu przekazał zestawienie zbiorcze w formacie edytowalnym (.xlsx / .csv) z podziałem na placówki prowadzone przez Miasto Bydgoszcz, opracowane na podstawie danych SIO (System Informacji Oświatowej) bez danych osobowych uczniów.",
  },
  {
    id: "kb-law-udip",
    type: "legal_act",
    caseNumber: "Dz.U. 2022 poz. 902",
    title: "Ustawa z dnia 6 września 2001 r. o dostępie do informacji publicznej (UDIP)",
    department: "Podstawa prawna ogólnourzędowa",
    date: "2025-10-01",
    tags: ["UDIP", "art. 4 ust. 3", "art. 13", "termin 14 dni", "anonimizacja"],
    questionSummary:
      "Podstawowe terminy i obowiązki organu przy rozpatrywaniu wniosków UDIP.",
    answerText:
      "Art. 13 ust. 1: Udostępnianie informacji publicznej następuje bez zbędnej zwłoki, nie później niż w terminie 14 dni od dnia złożenia wniosku. Art. 13 ust. 2: Jeśli informacja nie może być udostępniona w terminie 14 dni, podmiot powiadamia o powodach opóźnienia oraz o terminie, nie dłuższym niż 2 miesiące. Art. 4 ust. 3: Obowiązane do udostępnienia są podmioty będące w posiadaniu informacji. Art. 5 ust. 2: Prawo podlega ograniczeniu ze względu na prywatność osoby fizycznej lub tajemnicę przedsiębiorcy.",
  },
  {
    id: "kb-law-kpa",
    type: "legal_act",
    caseNumber: "t.j. Dz.U. 2024 poz. 572",
    title: "Ustawa z dnia 14 czerwca 1960 r. Kodeks postępowania administracyjnego (KPA)",
    department: "Podstawa prawna ogólnourzędowa",
    date: "2025-01-01",
    tags: ["KPA", "art. 64", "braki formalne", "doprecyzowanie", "decyzja"],
    questionSummary:
      "Zasady wzywania wnioskodawcy do uzupełnienia lub doprecyzowania podania oraz liczenia terminów.",
    answerText:
      "Art. 64 § 2 KPA: W przypadku nieprecyzyjnego zakresu żądania organ wzywa wnioskodawcę do doprecyzowania w terminie nie krótszym niż 7 dni z pouczeniem o pozostawieniu wniosku bez rozpoznania.",
  },
];

const SAMPLE_DOCUMENTS = [
  {
    id: "sample-schronisko",
    label: "Wniosek podobny do archiwum (Zwierzęta / WZiGK)",
    fileName: "wniosek_schronisko_2026.txt",
    description:
      "Zapytanie o liczbę bezdomnych psów i kotów oraz wydatki na schronisko — sprawdza dopasowanie do sprawy BKS.IV.1431.543.2025.",
    content: `WNIOSEK O UDOSTĘPNIENIE INFORMACJI PUBLICZNEJ
Data wpływu: 18 września 2026 r.
Wnioskodawca: Fundacja Przyjazna Łapa, ul. Gdańska 112/4, 85-022 Bydgoszcz
Kontakt: kontakt@przyjaznalapa.org

Na podstawie art. 2 ust. 1 ustawy o dostępie do informacji publicznej wnoszę o udostępnienie informacji publicznej w następującym zakresie:
1. Ile psów oraz ile kotów przyjęto pod opiekę Miejskiego Schroniska dla Zwierząt w Bydgoszczy w roku 2025?
2. Jaki był łączny budżet schroniska w 2025 r. oraz czy Miasto zawierało umowy z zewnętrznymi firmami na wyłapywanie bezdomnych zwierząt?
3. Z jaką kliniką weterynaryjną współpracowało schronisko w 2025 r.?

Proszę o przesłanie odpowiedzi drogą elektroniczną.`,
  },
  {
    id: "sample-pii-test",
    label: "Test anonimizacji (Dane osobowe i wrażliwe)",
    fileName: "wniosek_z_danymi_wrazliwymi.txt",
    description:
      "Dokument zawierający PESEL, adres zamieszkania, nr telefonu, rachunek bankowy, nr księgi wieczystej i tajemnicę przedsiębiorstwa do testu modułu RODO/UDIP.",
    content: `WNIOSEK O UDOSTĘPNIENIE INFORMACJI PUBLICZNEJ
Bydgoszcz, dnia 17 września 2026 r.

Wnioskodawca: Jan Kowalski
PESEL: 84051209876
Dowód osobisty: ABC 458912
Adres zamieszkania: ul. Słoneczna 14 m. 8, 85-123 Bydgoszcz
Telefon prywatny: +48 602 345 678
E-mail: jan.kowalski.prywatny@poczta.pl

Zwracam się o udostępnienie dokumentacji dotyczącej postępowania budowlanego prowadzonego dla działki nr 42/7 (KW nr BY1B/00045123/9) należącej do sąsiada Pana Marka Nowaka (zam. ul. Kwiatowa 3, Bydgoszcz), w tym:
1. Kopii odwołań wraz z informacją o stanie zdrowia wnioskodawcy (orzeczenie o niepełnosprawności) powołanym w piśmie z dnia 04.08.2026 r.
2. Zestawienia rozliczeń finansowych i numeru rachunku bankowego 12 1020 1462 0000 7802 0123 4567, na który przekazano rekompensatę, oraz numeru rejestracyjnego pojazdu CB 8921K wykorzystywanego przy kontroli.
3. Szczegółowej kalkulacji marży i technologii wykonania izolacji przekazanej przez wykonawcę Bud-Tech Sp. z o.o. zastrzeżonej jako tajemnica przedsiębiorstwa.`,
  },
  {
    id: "sample-redirect",
    label: "Wniosek do przekierowania (Art. 4 ust. 3 UDIP)",
    fileName: "wniosek_konserwator_zabytek.txt",
    description:
      "Zapytanie poza właściwością UMB — testuje wykrycie braku kompetencji i przekierowanie do Konserwatora Zabytków.",
    content: `WNIOSEK O INFORMACJĘ PUBLICZNĄ
Wnioskodawca: Redakcja Lokalna Bydgoszcz

Prosimy o informację o wynikach ekspertyzy konserwatorskiej zabytkowej kamienicy wpisanej do rejestru zabytków przy ul. Długiej oraz o miejscu obecnego składowania zdemontowanej rzeźby autorstwa Ludmiły Stehnovej wraz z harmonogramem prac konserwatorskich nadzorowanych przez Wojewódzkiego Konserwatora Zabytków.`,
  },
];

function loadInitialCases() {
  const csvPath = path.join(ROOT_DIR, "wnioski.csv");
  if (!fs.existsSync(csvPath)) {
    return [];
  }
  const raw = fs.readFileSync(csvPath, "utf-8");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Skip title row and header row
  const dataLines = lines.slice(2);
  return dataLines.map((line, idx) => {
    const cols = parseCsvLine(line);
    const lp = Number(cols[0]) || idx + 1;
    const caseNumber = cols[1] || `BKS.IV.1431.${idx + 1}.2026`;
    const applicant = (cols[2] || "Wnioskodawca").replace(/\u00a0/g, " ").trim();
    const subject = (cols[3] || "").replace(/\u00a0/g, " ").trim();
    const receivedRaw = cols[4] || "";
    const dueRaw = cols[5] || "";
    const responseRaw = cols[6] || "";
    const assignee = cols[7] || "Pracownik 1";

    const receivedDate = normalizeUsOrPlDate(receivedRaw, "2026-09-01");
    let dueDate = normalizeUsOrPlDate(dueRaw, "2026-09-15");
    // Fix CSV typo in row 6 (1/29/2025 for received 1/15/2026)
    if (dueDate < receivedDate && dueRaw.includes("2025") && receivedDate.startsWith("2026")) {
      dueDate = dueDate.replace("2025-", "2026-");
    }

    const responseDate = responseRaw
      ? normalizeUsOrPlDate(responseRaw, "2026-09-18")
      : null;

    // For realistic interactive hackathon demo on reference date 2026-09-18:
    // Cases 7, 9, 10 (September 2026) stay active in workflow stages so calendar highlighting is immediately visible!
    let status:
      | "brak_dzialan"
      | "zapytania_wyslane"
      | "kwerenda"
      | "doprecyzowanie"
      | "przygotowana"
      | "wyslana" = "wyslana";
    let demoResponseDate = responseDate;
    let kwerendaDays = 0;
    let recommendedDepartmentId = "bks";
    let tags = ["UDIP"];

    if (caseNumber.includes("293.2025") || caseNumber.includes("543.2026")) {
      recommendedDepartmentId = "wzigk";
      tags = ["zwierzęta", "schronisko", "WZiGK"];
    } else if (caseNumber.includes("307.2025") || caseNumber.includes("599.2026")) {
      recommendedDepartmentId = "weis";
      tags = ["edukacja", "szkoły", "cudzoziemcy"];
    } else if (caseNumber.includes("15.2026")) {
      recommendedDepartmentId = "kpwkz";
      tags = ["zabytek", "rzeźba", "przekierowanie"];
    } else if (caseNumber.includes("16.2026")) {
      recommendedDepartmentId = "wso";
      tags = ["alkohol", "zezwolenia", "WSO"];
    } else if (caseNumber.includes("17.2026")) {
      recommendedDepartmentId = "wzp";
      tags = ["umowy", "zamówienia", "WZP"];
    } else if (caseNumber.includes("18.2026")) {
      recommendedDepartmentId = "wzigk";
      tags = ["odpady", "mieszkańcy", "WZiGK"];
    } else if (caseNumber.includes("509.2026") || caseNumber.includes("590.2026")) {
      recommendedDepartmentId = "wab";
      tags = ["budownictwo", "Astoria", "WAB"];
    }

    if (caseNumber === "BKS.IV.1431.509.2026") {
      status = "doprecyzowanie";
      demoResponseDate = null;
      kwerendaDays = 30;
    } else if (caseNumber === "BKS.IV.1431.543.2026") {
      status = "przygotowana";
      demoResponseDate = null;
      kwerendaDays = 25;
    } else if (caseNumber === "BKS.IV.1431.590.2026") {
      status = "zapytania_wyslane";
      demoResponseDate = null;
    } else if (caseNumber === "BKS.IV.1431.599.2026") {
      status = "kwerenda";
      demoResponseDate = null;
      kwerendaDays = 14;
    }

    const matchingKb = KNOWLEDGE_BASE.find((k) =>
      k.caseNumber.includes(caseNumber.split(".").slice(2).join("."))
    );

    return {
      id: `case-${lp}`,
      lp,
      caseNumber,
      applicant,
      subject,
      fullRequestText: `Wniosek o udostępnienie informacji publicznej (${caseNumber})\nWnioskodawca: ${applicant}\nData wpływu: ${receivedDate}\n\nPrzedmiot zapytania:\n${subject}`,
      receivedDate,
      dueDate,
      dueDateNote: dueRaw.includes("doprecyzowanie") ? dueRaw : undefined,
      responseDate: demoResponseDate,
      assignee,
      status,
      kwerendaDays,
      tags,
      summary: subject,
      recommendedDepartmentId,
      departmentReplyText:
        caseNumber === "BKS.IV.1431.543.2026"
          ? "Informacja z WZiGK i Schroniska dla Zwierząt: opiekę sprawuje jednostka budżetowa Schronisko dla Zwierząt w Bydgoszczy (brak umów zewnętrznych na opiekę). W 2025 r. objęto opieką 839 psów i 560 kotów. Budżet wyniósł 3.143.761,14 zł. Realizowano Umowę 1/2022/SZ z Kliniką Weterynaryjną (dr Jan Kowalski, tel. 601-223-445)."
          : "",
      draftResponseText: matchingKb ? matchingKb.answerText : "",
      piiItems: [],
      savedToKnowledgeBase: Boolean(matchingKb),
      analysis: null,
    };
  });
}

function loadAnonymizationRules(): string[] {
  const txtPath = path.join(ROOT_DIR, "dane_podlegajace_anonimizacji.txt");
  if (!fs.existsSync(txtPath)) return [];
  const raw = fs.readFileSync(txtPath, "utf-8");
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l !== "Dane podlegające anonimizacji");
}

function findDeterministicPii(text: string): Array<{
  text: string;
  category: string;
  reason: string;
}> {
  const hits: Array<{ text: string; category: string; reason: string }> = [];
  const patterns: Array<{ regex: RegExp; category: string; reason: string }> = [
    {
      regex: /\b\d{11}\b/g,
      category: "Numer PESEL",
      reason: "11-cyfrowy identyfikator osoby fizycznej",
    },
    {
      regex: /\b[A-Z]{3}\s?\d{6}\b/g,
      category: "Numer i seria dowodu osobistego",
      reason: "Wzorzec serii i numeru dowodu tożsamości",
    },
    {
      regex: /\b\d{2}(?:\s?\d{4}){6}\b/g,
      category: "Numer rachunku bankowego osoby fizycznej",
      reason: "26-cyfrowy numer IBAN / rachunku bankowego",
    },
    {
      regex: /\b[A-Z0-9]{4}\/\d{8}\/\d\b/g,
      category: "Numer księgi wieczystej",
      reason: "Numer KW umożliwiający identyfikację właściciela",
    },
    {
      regex:
        /\b[a-zA-Z0-9._%+-]+@(?!um\.bydgoszcz\.pl|torun\.wkz\.gov\.pl|zdmikp\.bydgoszcz\.pl)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
      category: "Prywatny adres poczty elektronicznej (e-mail)",
      reason: "Adres e-mail spoza domeny urzędowej",
    },
    {
      regex: /(?:\+48\s?)?(?:\d{3}[-\s]?\d{3}[-\s]?\d{3})\b/g,
      category: "Prywatny numer telefonu",
      reason: "9-cyfrowy numer telefonu komórkowego",
    },
  ];

  for (const p of patterns) {
    const matches = text.matchAll(p.regex);
    for (const m of matches) {
      if (m[0]) {
        hits.push({
          text: m[0],
          category: p.category,
          reason: p.reason,
        });
      }
    }
  }
  return hits;
}

function resolveSpanPositions(
  fullText: string,
  candidates: Array<{ text: string; category: string; reason: string }>
) {
  const spans: Array<{
    id: string;
    text: string;
    category: string;
    reason: string;
    start: number;
    end: number;
    state: "suggested" | "accepted" | "rejected";
  }> = [];

  const occupied: Array<[number, number]> = [];
  const seenKey = new Set<string>();

  for (const c of candidates) {
    const needle = c.text?.trim();
    if (!needle || needle.length < 3) continue;
    let searchFrom = 0;
    while (searchFrom < fullText.length) {
      const idx = fullText.indexOf(needle, searchFrom);
      if (idx === -1) break;
      const end = idx + needle.length;
      const overlaps = occupied.some(
        ([s, e]) => !(end <= s || idx >= e)
      );
      const key = `${idx}:${end}`;
      if (!overlaps && !seenKey.has(key)) {
        occupied.push([idx, end]);
        seenKey.add(key);
        spans.push({
          id: `pii-${idx}-${end}`,
          text: needle,
          category: c.category,
          reason: c.reason,
          start: idx,
          end,
          state: "suggested",
        });
      }
      searchFrom = end;
    }
  }

  return spans.sort((a, b) => a.start - b.start);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "20mb" }));

  app.get("/api/initial-data", (_req, res) => {
    try {
      const cases = loadInitialCases();
      const anonymizationRules = loadAnonymizationRules();
      res.json({
        cases,
        departments: DEPARTMENTS,
        knowledgeBase: KNOWLEDGE_BASE,
        anonymizationRules,
        sampleDocuments: SAMPLE_DOCUMENTS,
      });
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się wczytać danych początkowych.",
      });
    }
  });

  app.post("/api/parse-document", async (req, res) => {
    try {
      const { fileName, base64Data, plainText } = req.body as {
        fileName?: string;
        base64Data?: string;
        plainText?: string;
      };

      if (plainText && typeof plainText === "string") {
        return res.json({
          fileName: fileName || "dokument.txt",
          text: plainText.trim(),
        });
      }

      if (!base64Data || !fileName) {
        return res
          .status(400)
          .json({ error: "Brak pliku lub treści do przetworzenia." });
      }

      const buffer = Buffer.from(base64Data, "base64");
      const lower = fileName.toLowerCase();
      let extractedText = "";

      if (lower.endsWith(".pdf")) {
        const parsed = await pdfParse(buffer);
        extractedText = (parsed.text || "").trim();
      } else if (lower.endsWith(".docx")) {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = (result.value || "").trim();
      } else {
        extractedText = buffer.toString("utf-8").trim();
      }

      if (!extractedText) {
        return res.status(422).json({
          error:
            "Nie udało się wyodrębnić warstwy tekstowej z pliku (plik może być skanem graficznym).",
        });
      }

      return res.json({
        fileName,
        text: extractedText,
      });
    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error
            ? `Błąd odczytu dokumentu: ${error.message}`
            : "Błąd odczytu dokumentu.",
      });
    }
  });

  app.post("/api/analyze-request", async (req, res) => {
    try {
      const { text, knowledgeBase, departments, currentDepartment } = req.body as {
        text: string;
        knowledgeBase: Array<{
          id: string;
          caseNumber: string;
          title: string;
          department: string;
          questionSummary: string;
          answerText: string;
        }>;
        departments: typeof DEPARTMENTS;
        currentDepartment?: string;
      };

      if (!text || text.trim().length < 10) {
        return res.status(400).json({
          error: "Treść wniosku jest zbyt krótka do przeprowadzenia analizy.",
        });
      }

      const ai = getGeminiClient();
      const kbContext = (knowledgeBase || KNOWLEDGE_BASE)
        .map(
          (k) =>
            `[ID: ${k.id} | Nr: ${k.caseNumber} | Wydział: ${k.department}] Tytuł: ${k.title}\nPytanie: ${k.questionSummary}\nOdpowiedź: ${k.answerText.slice(0, 600)}`
        )
        .join("\n---\n");

      const deptContext = (departments || DEPARTMENTS)
        .map(
          (d) =>
            `- ID: ${d.id} | ${d.name} (${d.isExternal ? "ZEWNĘTRZNY DYSPONENT art. 4 ust. 3" : "Wydział UMB"}) — Zakres: ${d.scope}`
        )
        .join("\n");

      const prompt = `Przeanalizuj poniższy wniosek o udostępnienie informacji publicznej (UDIP) wpływający do jednostki: ${currentDepartment || "Biuro Komunikacji Społecznej Urzędu Miasta Bydgoszczy"}.

BAZA WIEDZY I ARCHIWUM SPRAW:
${kbContext}

DOSTĘPNE WYDZIAŁY UMB I DYSPONENCI ZEWNĘTRZNI:
${deptContext}

TREŚĆ WNIOSKU:
"""
${text}
"""

Zadania analizy:
1. Podsumuj wniosek w 2-3 zwięzłych zdaniach po polsku.
2. Wygeneruj 3-5 krótkich tagów tematycznych.
3. Wyodrębnij dane metryczne: nazwę/imię wnioskodawcy, skrócony temat do tabeli kalendarza, wykrytą datę oraz ocenę pilności.
4. Sprawdź Bazę Wiedzy: czy podobne pytanie było zadane wcześniej (knowledgeBaseMatchFound: true/false)? Podaj listę pasujących spraw z procentem podobieństwa (0-100), uzasadnieniem i fragmentem do wykorzystania.
5. Wskaż ścieżkę / potencjalny redirect (routingPredictions): 1-3 wydziały UMB lub zewnętrznego dysponenta (np. KPWKZ jeśli UMB nie jest dysponentem w trybie art. 4 ust. 3 UDIP, albo WAB / WZiGK / WEiS / ZDMiKP / WSO / WZP). Dla każdego określ actionType ('internal_inquiry', 'external_redirect', 'clarification', 'direct_answer') oraz pewność (0-100).
6. Przygotuj propozycję krótkiego pisma / zapytania wewnętrznego do wiodącego wydziału merytorycznego (tylko propozycja robocza dla urzędnika — system nie wysyła go automatycznie).
7. Wskaż właściwą podstawę prawną (np. Art. 13 ust. 1 UDIP, Art. 4 ust. 3 UDIP).`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          systemInstruction:
            "Jesteś inteligentnym asystentem prawnym i administracyjnym Biura Komunikacji Społecznej Urzędu Miasta Bydgoszczy. Analizujesz wnioski UDIP z najwyższą precyzją prawną i merytoryczną. Odpowiadasz wyłącznie poprawnym JSON zgodnym ze schematem.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              extractedMetadata: {
                type: Type.OBJECT,
                properties: {
                  applicantName: { type: Type.STRING },
                  subject: { type: Type.STRING },
                  detectedDate: { type: Type.STRING },
                  urgencyHint: { type: Type.STRING },
                },
                required: [
                  "applicantName",
                  "subject",
                  "detectedDate",
                  "urgencyHint",
                ],
              },
              knowledgeBaseMatchFound: { type: Type.BOOLEAN },
              similarCases: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    kbId: { type: Type.STRING },
                    caseNumber: { type: Type.STRING },
                    title: { type: Type.STRING },
                    similarityPercent: { type: Type.INTEGER },
                    reason: { type: Type.STRING },
                    reusableExcerpt: { type: Type.STRING },
                  },
                  required: [
                    "kbId",
                    "caseNumber",
                    "title",
                    "similarityPercent",
                    "reason",
                    "reusableExcerpt",
                  ],
                },
              },
              routingPredictions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    departmentId: { type: Type.STRING },
                    departmentName: { type: Type.STRING },
                    isExternal: { type: Type.BOOLEAN },
                    confidencePercent: { type: Type.INTEGER },
                    actionType: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                  required: [
                    "departmentId",
                    "departmentName",
                    "isExternal",
                    "confidencePercent",
                    "actionType",
                    "reason",
                  ],
                },
              },
              departmentInquiryDraft: { type: Type.STRING },
              legalBasis: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: [
              "summary",
              "tags",
              "extractedMetadata",
              "knowledgeBaseMatchFound",
              "similarCases",
              "routingPredictions",
              "departmentInquiryDraft",
              "legalBasis",
            ],
          },
        },
      });

      const analysis = JSON.parse(response.text || "{}");
      return res.json({ analysis });
    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error
            ? `Błąd analizy AI: ${error.message}`
            : "Błąd analizy AI.",
      });
    }
  });

  app.post("/api/detect-pii", async (req, res) => {
    try {
      const { text } = req.body as { text: string };
      if (!text || !text.trim()) {
        return res.json({ piiItems: [] });
      }

      const rules = loadAnonymizationRules();
      const deterministic = findDeterministicPii(text);

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: `Przeanalizuj poniższy tekst pisma urzędowego pod kątem ochrony danych osobowych i informacji prawnie chronionych (RODO / UDIP art. 5 ust. 2).

KATALOG DANYCH PODLEGAJĄCYCH ANONIMIZACJI (wzorzec UMB):
${rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

WAŻNE ZASADY:
- Wyodrębnij DOKŁADNE fragmenty tekstu (substringi 1:1 z tekstu wejściowego), które należy zanonimizować: imiona i nazwiska osób fizycznych NIEPEŁNIĄCYCH funkcji publicznej (np. Jan Kowalski, Marek Nowak), PESEL, numery dowodów, adresy prywatne, prywatne telefony i e-maile, numery kont bankowych, numery ksiąg wieczystych, numery działek identyfikujące osobę prywatną, numery rejestracyjne pojazdów prywatnych, dane o stanie zdrowia/niepełnosprawności, tajemnicę przedsiębiorstwa.
- NIE anonimizuj nazw urzędów (Urząd Miasta Bydgoszczy, Biuro Komunikacji Społecznej, Wydział Zieleni i Gospodarki Komunalnej), danych kontaktowych urzędu (ul. Jezuicka 1, bks@um.bydgoszcz.pl), sygnatur spraw (BKS.IV.1431...) ani nazwisk osób pełniących funkcje publiczne (np. Prezydent Miasta) jeśli występują w roli służbowej.

TEKST DO ANALIZY:
"""
${text}
"""`,
        config: {
          systemInstruction:
            "Jesteś inspektorem ochrony danych (IOD) w Urzędzie Miasta Bydgoszczy. Wskazujesz dokładne fragmenty wymagające anonimizacji przed publikacją lub udostępnieniem w trybie UDIP.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    category: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                  required: ["text", "category", "reason"],
                },
              },
            },
            required: ["items"],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{"items":[]}');
      const aiItems = Array.isArray(parsed.items) ? parsed.items : [];
      const merged = [...deterministic, ...aiItems];
      const piiItems = resolveSpanPositions(text, merged);

      return res.json({ piiItems });
    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error
            ? `Błąd modułu anonimizacji: ${error.message}`
            : "Błąd modułu anonimizacji.",
      });
    }
  });

  app.post("/api/generate-response", async (req, res) => {
    try {
      const {
        caseNumber,
        applicant,
        requestText,
        departmentReplyText,
        responseMode,
        similarContext,
        officialNotes,
      } = req.body as {
        caseNumber: string;
        applicant: string;
        requestText: string;
        departmentReplyText: string;
        responseMode: "merit" | "clarification" | "redirect" | "extension";
        similarContext?: string;
        officialNotes?: string;
      };

      const modeInstructions: Record<string, string> = {
        merit:
          "Przygotuj pełną ODPOWIEDŹ MERYTORYCZNĄ w trybie ustawy o dostępie do informacji publicznej (wzorzec pisma BKS.IV.1431.543.2025). Jeżeli wniosek zawiera kilka pytań, zastosuj przejrzystą numerację Ad 1, Ad 2, Ad 3... Opieraj się ściśle na odpowiedzi z wydziału merytorycznego (bez zmyślania faktów czy liczb).",
        clarification:
          "Przygotuj WEZWANIE DO DOPRECYZOWANIA ZAKRESU OTRZYMANEGO WNIOSKU (wzorzec pisma BKS.IV.1431.509.2026) z terminem 7 dni na doprecyzowanie pod rygorem pozostawienia wniosku bez rozpoznania oraz wyznaczeniem nowego terminu rozpatrzenia na podstawie art. 13 ust. 2 ustawy z 06.09.2001 r. o dostępie do informacji publicznej (Dz. U. z 2022 r. poz. 902, z 2025 r. poz. 1844).",
        redirect:
          "Przygotuj pismo informujące, że Urząd Miasta Bydgoszczy NIE JEST DYSPONENTEM wnioskowanych danych zgodnie z art. 4 ust. 3 ustawy z dnia 6 września 2001 r. o dostępie do informacji publicznej (wzorzec pisma BKS.IV.1431.15.2026) i wskazujące właściwy organ wraz z danymi kontaktowymi.",
        extension:
          "Przygotuj ZAWIADOMIENIE O PRZEDŁUŻENIU TERMINU (KWERENDA) na podstawie art. 13 ust. 2 ustawy z dnia 6 września 2001 r. o dostępie do informacji publicznej, podając powód opóźnienia (konieczność przeprowadzenia kwerendy archiwalnej / anonimizacji) oraz nowy termin (nie dłuższy niż 2 miesiące).",
      };

      const todayPl = new Date().toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const ai = getGeminiClient();
      const prompt = `Sporządź projekt oficjalnego pisma Biura Komunikacji Społecznej Urzędu Miasta Bydgoszczy.

METRYKA SPRAWY:
- Znak sprawy: ${caseNumber || "BKS.IV.1431.NOWY.2026"}
- Data pisma: Bydgoszcz, dnia ${todayPl}
- Adresat / Wnioskodawca: ${applicant || "Szanowny Panie / Szanowna Pani"}

TRYB PISMA:
${modeInstructions[responseMode] || modeInstructions.merit}

TREŚĆ WNIOSKU:
"""
${requestText || ""}
"""

ODPOWIEDŹ / MATERIAŁY Z WYDZIAŁU MERYTORYCZNEGO:
"""
${departmentReplyText || "Brak załączonej odpowiedzi z wydziału — przygotuj strukturę z wyraźnymi polami [DO UZUPEŁNIENIA PRZEZ URZĘDNIKA], jeśli brakuje konkretnych danych liczbowych."}
"""

${similarContext ? `PODOBNA SPRAWA ARCHIWALNA (KONTEKST STYLU):\n${similarContext}\n` : ""}
${officialNotes ? `DODATKOWE UWAGI URZĘDNIKA:\n${officialNotes}\n` : ""}

Zadbaj o oficjalny styl Urzędu Miasta Bydgoszczy:
- Nagłówek ze znakiem sprawy i datą
- Zwrot grzecznościowy ("Szanowny Panie," / "Szanowna Pani," / "Szanowni Państwo,")
- Zakończenie:
"Łączę wyrazy szacunku,

Biuro Komunikacji Społecznej
Urząd Miasta Bydgoszczy"

Zwróć wyłącznie gotową treść pisma (bez komentarzy technicznych ani znaczników markdown).`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          systemInstruction:
            "Jesteś doświadczonym urzędnikiem Biura Komunikacji Społecznej Urzędu Miasta Bydgoszczy. Piszesz precyzyjne, zgodne z prawem polskim (UDIP, KPA) pisma urzędowe. Nigdy nie zmyślasz faktów nieobecnych w danych z wydziału.",
        },
      });

      const draftText = (response.text || "").trim();
      return res.json({ draftText });
    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error
            ? `Błąd generowania projektu pisma: ${error.message}`
            : "Błąd generowania projektu pisma.",
      });
    }
  });

  app.post("/api/export-doc", (req, res) => {
    const { caseNumber, content, format } = req.body as {
      caseNumber?: string;
      content: string;
      format: "doc" | "txt";
    };

    const safeName = (caseNumber || "odpowiedz_udip").replace(/[^a-zA-Z0-9._-]/g, "_");

    if (format === "txt") {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName}.txt"`
      );
      return res.send(content || "");
    }

    const escaped = (content || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(
        /\[ANONIMIZOWANO\]/g,
        '<span style="background:#000000;color:#000000;padding:0 4px;">[ANONIMIZOWANO]</span>'
      )
      .replace(/\n/g, "<br/>");

    const htmlDoc = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="pl">
<head>
<meta charset="utf-8"/>
<title>${safeName}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #111827; margin: 2.5cm; }
  .header { border-bottom: 1px solid #1e293b; padding-bottom: 10px; margin-bottom: 24px; }
  .org { font-size: 13pt; font-weight: bold; }
  .dept { font-size: 11pt; color: #334155; }
  .footer { margin-top: 36px; border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 8.5pt; color: #475569; }
</style>
</head>
<body>
  <div class="header">
    <div class="org">URZĄD MIASTA BYDGOSZCZY</div>
    <div class="dept">Biuro Komunikacji Społecznej</div>
  </div>
  <div>${escaped}</div>
  <div class="footer">
    85-102 Bydgoszcz, ul. Jezuicka 1 · tel. (52) 58 58 365 · email: bks@um.bydgoszcz.pl · www.bydgoszcz.pl
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "application/msword; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}.doc"`
    );
    return res.send(htmlDoc);
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(ROOT_DIR, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Asystent UDIP server listening on http://localhost:${PORT}`);
  });
}

startServer();
