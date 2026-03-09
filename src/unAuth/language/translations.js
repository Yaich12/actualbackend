import { getPublicAssetUrl } from "../../utils/publicAssets";

export const TRANSLATIONS = {
  da: {
    navbar: {
      cta: {
        booking: "Gå til systemet",
        tryFree: "Prøv gratis",
      },
      languageLabel: "Vælg sprog",
      languages: {
        danish: "Dansk",
        english: "Engelsk",
      },
      logo: {
        tagline: "Til klinikker der vil mere",
      },
      menu: {
        solutions: {
          title: "Løsninger",
          itemsHeader: "For klinikker",
          items: {
            individuals: {
              title: "Selvstændige",
              description: "Alt-i-ét for solo-behandlere.",
            },
            smallBusiness: {
              title: "Små klinikker",
              description: "Planlægning, journal og økonomi samlet.",
            },
          },
          featured: {
            title: "Byg din klinik",
            description: "Booking, journal og AI i ét system.",
            alt: "Overblik i Selma+",
          },
        },
        features: {
          title: "Funktioner",
          itemsHeader: "Udforsk",
          items: {
            transcription: { title: "Transkribering & diktering" },
            copilot: { title: "Selma Copilot" },
            website: { title: "Online booking & betaling" },
          },
        },
        professions: {
          title: "Fagområder",
          itemsHeader: "Tilpasset til",
          itemsNote: "Flere fag tilføjes løbende.",
          items: {
            physio: "Fysioterapi",
            osteo: "Osteopati",
            chiro: "Kiropraktik",
          },
        },
        pricing: { title: "Priser" },
        about: { title: "Om os" },
      },
    },
    common: {
      back: "Tilbage",
      close: "Luk",
      brand: "Selma+",
      brandName: "Selma",
      brandShort: "S+",
      ai: "AI",
      soap: "SOAP",
      placeholder: "—",
      availabilityValue: "24/7",
      units: {
        minutes: "min",
        currency: "kr",
      },
    },
    landing: {
      divider: {
        text: "FRA FYSIOER TIL FYSIOER",
        aria: "Sektionsskiller",
      },
      frontpage: {
        titleLine1: "Styrk din praksis",
        titleLine2: "med Selma+",
        subtitle:
          "Booking, journalføring og din kliniske assistent — samlet i ét system.",
        ctaPrimary: "Kom i gang gratis",
        ctaSecondary: "Se demo",
      },
      heroDevices: {
        eyebrow: "Selma+ platform",
        title: "Et bookingsystem bygget til sundhedspraksis.",
        description:
          "Selma+ er en platform til sundhedsprofessionelle, hvor kalender, patientoverblik og journal hænger naturligt sammen. Med transkribering og diktering kan du lave journaltekst hurtigere Og når du er i tvivl under en konsultation, har du Selma+ som en integreret, evidensbaseret hjælper, der kan afklare differentialdiagnostik og støtte dine beslutninger med afsæt i pålidelige kilder",
        cta: "Prøv Selma+ booking",
        hint: "Ingen installation. Kræver kun et login",
      },
      heroJournal: {
        eyebrow: "Selma+ platform",
        title: "Journalføring, der arbejder sammen med dig.",
        description:
          "Selma+ er ikke bare AI-snak. Under motorhjelmen bruger vi avanceret AI-teknologi med rødder i Corti — en af Europas mest anerkendte sundheds-AI-platforme, som er udviklet med klinisk kvalitet og sikkerhed i fokus.\n\nHvad betyder det for dig?\n\nMedicinprodukt-registrering i EU & UK – Corti Assistant er officielt registreret som medicinsk device i både EU og hos UK’s MHRA, hvilket betyder at teknologien er vurderet efter strenge regulatoriske krav før brug i kliniske sammenhænge.\n\nHealthcare-grade sikkerhed og data-compliance – Platformen overholder internationale standarder som HIPAA (fortrolig patientdata i USA), GDPR (EU/UK), ISO/IEC 27001, SOC2 og mere – så dine patienters data håndteres sikkert og efter gældende lovgivning.\n\nBygget til klinikere af klinikere – AI-modellerne er trænet specifikt på medicinske samtaler og terminologi for at give nøjagtige transskriptioner og klinisk relevante forslag — så du kan fokusere på patienten, ikke på systemet.\n\nDet betyder, at du kan bruge Selma+ med ro i maven",
        cta: "Prøv Selma+ booking",
        hint: "Ingen installation. Kræver kun et login",
        videoTitles: {
          dictation: "Diktering",
          transcriptionFirstConsultation: "Transkribering - Førstegangskonsultation",
        },
      },
      aboutSection: {
        statsLine: "Et nyt kapitel. Bygget til behandlere.",
        rightHeadline: "Bygget med klinikker.",
        rightSubline: "Formet af feedback fra praksis.",
        title: "Fra klinisk hverdag til intelligent platform.",
        paragraphOne:
          "Selma+ er grundlagt fordi de systemer der fandtes aldrig helt opfyldte vores behov. Samtidig så vi, hvordan teknologi og AI forandrede verden omkring os.",
        paragraphTwo:
          "Selma+ samler booking, journal og intelligent klinisk støtte i én moderne platform, formet af feedback fra praksis og designet til fremtidens sundhedsprofessionelle.",
        foundersName: "Designet i Danmark.",
        foundersRole: "Skabt af fysioterapeuter.",
        ctaPrompt: "Klar til at samle det hele i ét moderne system?",
        ctaButton: "Udforsk Selma+",
      },
      manifesto: {
        line1:
          "Vi fandt ud af, at et professionelt system ikke behøver koste en formue.",
        line2: "Ingen dyre hjemmesider. Ingen tunge IT-systemer.",
        line3: "Vi valgte at bygge det selv, fordi vi kunne gøre det bedre.",
        line4: "Velkommen til Selma+.",
      },
      demo: {
        words: "Et roligt klinikflow - fra booking til journal til opfølgning.",
        timeline: [
          {
            title: "Kom godt i gang",
            date: "Dag 1",
            category: "Opsætning",
            content:
              "Tilføj personale, ydelser og åbningstider på få minutter.",
          },
          {
            title: "Bookinger lander",
            date: "Uge 1",
            category: "Booking",
            content: "Patienter booker online og kalenderen fyldes automatisk.",
          },
          {
            title: "Journal i flow",
            date: "Uge 2",
            category: "Journal",
            content:
              "Transkription og FactsR hjælper dig med notaterne.",
          },
          {
            title: "Drift i ro",
            date: "Uge 3",
            category: "Drift",
            content: "Fakturering, opfølgninger og overblik er samlet.",
          },
        ],
      },
      parallax: {
        sections: {
          collaborate: {
            subheading: "Samarbejd i flow",
            heading: "Alle dine data i samme system",
          },
          quality: {
            subheading: "Kvalitet i hver session",
            heading: "Sikker dokumentation uden ekstra klik",
          },
        },
      },
      globeFeature: {
        title: "Skabt af fysioterapeuter. Bygget til moderne klinikker.",
        subtitle:
          "Billigere og smartere kliniksoftware med integreret AI – uden ekstra moduler, skjulte gebyrer eller unødvendig administration.",
        cta: "Kom i gang i dag",
      },
      statsSection: {
        title: "Friheden er tættere på, end du tror.",
        description:
          "I dag arbejder kun en lille procentdel af nordiske behandlere som selvstændige. Hvorfor? Fordi administrationen har været en bremseklods. Vi har bygget Selma+ for at fjerne den barriere, så du kan fokusere på det, du er bedst til.",
        cta: "Bliv en del af fremtiden ->",
        stats: [
          { label: "EU gennemsnit", flag: "🇪🇺", value: "13%", note: "Stigende trend" },
          { label: "Danmark", flag: "🇩🇰", value: "7.4%", note: "Stort potentiale" },
          { label: "Norge", flag: "🇳🇴", value: "3.9%", note: "Uudnyttet marked" },
          { label: "Sverige", flag: "🇸🇪", value: "8.5%", note: "I vækst" },
        ],
        slides: [
          {
            title: "Sikker klinikdata i EU",
            text:
              "Alt data i Selma+ gemmes på sikre servere i EU og behandles efter GDPR. Journaler, aftaler og personoplysninger er krypteret både under overførsel og i hvile. Adgang styres med sikre logins og rollebaserede rettigheder, så kun de rette personer ser det nødvendige.",
            image: getPublicAssetUrl("hero-2/pexels-eberhardgross-1743364.jpg"),
            alt: "Sikker lagring af klinikdata i EU",
          },
          {
            title: "Mere nærvær i konsultationen",
            text:
              "Selma+ gør det lettere at være til stede med patienten i stedet for skærmen. Noter fanges via skabeloner, genveje og evt. tale-til-tekst, så dokumentationen ikke stjæler samtalen. Systemet strukturerer informationen og kan efterfølgende opsummere forløbet, så du hurtigt får overblik.",
            image: getPublicAssetUrl("hero-2/pexels-shkrabaanthony-5217850.jpg"),
            alt: "Mere nærvær i konsultationen",
          },
          {
            title: "Overblik uden administrationskaos",
            text:
              "Med Selma+ slipper du for administrations-kaos og får et system, der arbejder for dig. Aftaler, påmindelser, journaler og nøgletal samles ét sted og opdateres automatisk. Platformen hjælper dig med at holde styr på udviklingen i patienternes forløb og kan inspirere til næste faglige skridt.",
            image: getPublicAssetUrl("hero-2/pexels-thirdman-5060985.jpg"),
            alt: "Samlet overblik og mindre administration",
          },
        ],
      },
      heroCards: {
        title: "Byg din klinik med Selma+",
        description:
          "En samlet platform til booking, journal og drift - med AI der hjælper dig hele vejen.",
        subtitle: "Alt det kliniske i ét roligt flow.",
        ctaPrimary: "Se demo",
        ctaSecondary: "Kom i gang",
        cards: {
          digitalReception: {
            label: "Digital reception",
            widgetTitle: "Selma+ Reception",
            message: "Velkommen til Klinik Selma, hvad kan jeg hjælpe med?",
            inputPlaceholder: "Skriv en besked...",
            send: "Send",
            title: "Din klinik er altid åben",
            description:
              "Få en smuk hjemmeside med indbygget AI-receptionist. Den tager imod nye patienter og svarer på spørgsmål døgnet rundt - også mens du sover.",
            cta: "Se løsningen",
          },
          intelligentSystem: {
            label: "Intelligent system",
            calendar: "Kalender",
            journal: "Journal",
            title: "Mere tid til behandling",
            description:
              "Slut med at klikke rundt. I Selma+ er din kalender og journal smeltet sammen, og AI-assistenten hjælper dig med at skrive notaterne lynhurtigt.",
            ctaPrimary: "Udforsk systemet",
            ctaSecondary: "Mød Ally",
          },
          overview: {
            label: "Overblik",
            metricLabel: "Omsætning",
            status: "Status: Alt afstemt",
            title: "Ro i maven omkring tallene",
            description:
              "Slip for det manuelle bøvl. Fakturering, indberetning til 'danmark' og regnskab sker automatisk i baggrunden.",
            cta: "Se funktioner",
          },
        },
      },
      footer: {
        columns: {
          landing: {
            title: "Landingsside",
            items: {
              hero: "Forside",
              platform: "Platform",
              workflow: "Overblik",
              about: "Om Selma+",
              stats: "Statistik",
              pricing: "Priser",
            },
          },
          features: {
            title: "Funktioner",
            items: {
              transcription: "Transkribering & diktering",
              copilot: "Selma Copilot",
              website: "Online booking & betaling",
            },
          },
          about: {
            title: "Om",
            items: {
              company: "Virksomhed",
              pricing: "Priser",
              linkedin: "LinkedIn",
            },
          },
        },
      },
    },
    pricing: {
      title: "Alt din klinik behøver – i én platform",
      description:
        "Booking, journal, AI-assistent og betaling samlet ét sted.\nIngen moduler. Ingen skjulte gebyrer.",
      switch: {
        monthly: "Månedlig betaling",
        yearly: "Årlig betaling",
        savings: "Spar 20%",
      },
      planTitle: "{name}",
      labels: {
        popular: "Mest populære",
        year: "år",
        month: "måned pr behandler",
        features: "Funktioner",
        contactForPrice: "Kontakt for pris",
      },
      secondaryCta: "Kontakt salg",
      trust: ["Ingen bindingsperiode", "Gratis onboarding", "Dansk support"],
      plans: {
        starter: {
          name: "Selma+ Plan",
          description: "En komplet klinikplatform til moderne behandlere.",
          buttonText: "Kom i gang",
          priceNote: "Alt inkluderet",
          includes: [
            "Inkluderet:",
            "Online booking-side til patienter",
            "Kalender med booking-overblik",
            "Journalisering af patienter",
            "Ubegrænset antal patienter og behandlinger",
            "AI-transkribering af konsultationer",
            "Diktering direkte til journalnoter",
            "Selma Assistent i journalen",
            "– foreslår objektive tests",
            "– identificerer røde flag",
            "– foreslår øvelser",
            "– hjælper med journalstruktur",
            "Journal-skabeloner",
            "Dedikeret onboarding",
            "Teamfunktioner (flere behandlere kan arbejde i samme system)",
            "Patientdatabase",
            "SelmaPay – modtag betaling fra patienter (kort, MobilePay, Apple Pay, Google Pay)",
          ],
          featureNote:
            "Betalinger via SelmaPay har kun standard transaktionsgebyrer\n(ca. 1.5% + 1.80 kr pr betaling).\n\nSelma+ tager ingen ekstra platformgebyrer.",
        },
        enterprise: {
          name: "Enterprise",
          description: "Til større klinikker med flere behandlere eller lokationer.",
          buttonText: "Kontakt os",
          includes: [
            "Inkluderet:",
            "Ubegrænset antal brugere",
            "Flere kliniklokationer",
            "Avancerede roller og adgangsstyring",
            "Integrationer og API",
            "Dedikeret onboarding",
          ],
        },
      },
    },
    features: {
      intelligentBooking: {
        ctaTryFree: "Prøv gratis",
        hero: {
          eyebrow: "Intelligent booking",
          title: "Bookinger der fylder kalenderen for dig",
          description:
            "Selma+ gør det nemt for patienter at booke, og giver dig overblik i realtid.",
          meta: "Ingen binding - klar på få minutter",
          panelTitle: "Direkte kalender",
          panelStatus: "Opdateres",
          teamView: "Team-overblik",
          aiSuggestions: {
            label: "AI forslag",
            title: "Foreslå næste tid",
            description:
              "Selma+ finder den bedste tid og holder fyldningsgraden høj.",
          },
          teamMembers: ["Jonas", "Sofie", "Emma"],
        },
        visualOverview: {
          eyebrow: "Visuelt overblik",
          title: "Planlæg teamet uden excel",
          description:
            "Se tilgængelighed og belastning på tværs af behandlere.",
          bullets: [
            "Træk-og-slip-planlægning",
            "Se belastning pr. behandler",
            "Hold ventelister i gang",
            "Kommunikér direkte med patienter",
          ],
          panelTitle: "Ugens kalender",
          panelTag: "Team",
          panelNote: "Overblik over belastning og ledige slots.",
          teamLabels: ["Lina", "Jonas", "Mette"],
        },
        journal: {
          panelTitle: "Direkte journal",
          voiceRecording: "Lydoptagelse",
          transcriptLabel: "Transkript",
          transcriptText:
            "Patient: Smerten er faldet siden sidst og bevægeligheden er bedre.",
          soapItems: [
            "S: Smerter reduceret",
            "O: Bedre ROM",
            "A: Fremgang i funktion",
            "P: Juster øvelser",
          ],
          eyebrow: "Journal & AI",
          title: "Noter uden efterarbejde",
          description:
            "Transkription og FactsR hjælper dig med at skrive journalen hurtigt og korrekt.",
          cta: "Se FactsR",
          bullets: [
            "Automatiske forslag til SOAP",
            "Sikker lagring og deling",
            "Mindre dokumentationstid",
          ],
        },
        copilotCallout: {
          eyebrow: "Selma Copilot",
          title: "Få en AI-kollega i journalen",
          description:
            "Ally giver forslag, opsummerer og holder styr på næste skridt.",
          cta: "Se Selma Copilot",
        },
        business: {
          eyebrow: "Forretning",
          title: "Mere omsætning med mindre administration",
          description:
            "Hold styr på nøgletal og vækst, uden ekstra systemer.",
          revenue: {
            label: "Omsætning",
            value: "1.100.000 kr.",
            delta: "+8% sidste 30 dage",
          },
          kpi: {
            label: "Nøgletal",
            items: {
              utilization: "Belægning",
              returning: "Gentagne patienter",
              growth: "Vækst",
            },
            note: "Opdateres automatisk hver dag",
          },
        },
      },
      operations: {
        ctaTryFree: "Prøv gratis",
        hero: {
          eyebrow: "Drift & økonomi",
          title: "Få ro i økonomien og styr på driften",
          description:
            "Selma+ samler betalinger, rapportering og teamstyring, så klinikken kører i ro.",
          meta: "Ingen binding - klar på få minutter",
          panelTitle: "Klinik overblik",
          panelStatus: "Direkte",
          revenueLabel: "Omsætning",
          revenueValue: "112.540 kr.",
          revenueDelta: "+12% denne måned",
          reconcileLabel: "Afstemning",
          reconcileTitle: "Alt afstemt",
          reconcileDescription:
            "Udbetalinger og kortbetalinger matcher automatisk.",
        },
        finance: {
          eyebrow: "Økonomi",
          title: "Betalinger og rapportering uden bøvl",
          cards: {
            billing: {
              title: "Betalinger",
              description: "Kort, MobilePay og faktura samlet ét sted.",
            },
            integrations: {
              title: "Integrationer",
              description: "Synk til regnskab og bank",
            },
            analytics: {
              title: "Indsigt",
              description:
                "Få overblik over omsætning, belægning og trends.",
            },
          },
          integrations: ["e-conomic", "Dinero", "Bank", "Stripe"],
        },
        team: {
          eyebrow: "Team",
          title: "Hold styr på klinikken",
          description:
            "Planlæg behandlere, rum og ressourcer uden regneark.",
          bullets: [
            "Planlæg vagter og rum",
            "Fælles kalender for hele teamet",
            "Automatiske opgaver og opfølgninger",
          ],
          panelTitle: "Team overblik",
          panelTag: "Denne uge",
          panelMembers: ["Jonas", "Emma", "Lars"],
          panelNote: "Træk og slip for at flytte vagter og rum.",
        },
        programs: {
          panelTitle: "Forløb",
          panelTag: "Aktivt",
          panelName: "Sportsgenoptræning",
          panelPasses: "8 ud af 12 sessioner",
          panelSessionLabel: "Næste session",
          panelSessionTime: "Torsdag 14:00",
          panelProgramLabel: "Program",
          panelProgramValue: "Genoptræning",
          eyebrow: "Forløb",
          title: "Hold styr på forløb og klippekort",
          description:
            "Få overblik over klip, deltagelse og progression på tværs af patienter.",
        },
      },
      transcriptionFactsr: {
        hero: {
          badge: "Eksklusiv",
          eyebrow: "Transkribering & FactsR",
          title: "Få kliniske noter automatisk",
          description:
            "Selma+ lytter, transskriberer og strukturerer samtalen, så du kan fokusere på patienten.",
          ctaPrimary: "Prøv gratis",
          ctaSecondary: "Se arbejdsgang",
          pillTranscription: "Direkte transkribering",
          pillFactsr: "FactsR kliniske fakta",
        },
      },
      selmaCopilot: {
        ctaTryFree: "Prøv systemet gratis",
        hero: {
          badge: "Eksklusiv",
          badgeLabel: "Selma Copilot",
          title: "Selma Copilot: Skabt til klinisk praksis.",
          descriptionIntro: "Mød",
          assistantName: "Selma",
          descriptionOutro:
            ". Din nye intelligente kollega, der kender dine patienter, husker retningslinjerne og altid har tid til faglig sparring.",
          tagline: "AI-laget der gør Selma+ til din mest erfarne kollega.",
        },
        alwaysOn: {
          eyebrow: "Selma, din AI-agent",
          title: "Selma sidder altid klar i sidepanelet.",
          description:
            "Selma Copilot kører som et sidepanel i dit system, så du kan spørge om råd, få udkast og sikre dokumentation uden at forlade patienten.",
        },
        features: [
          {
            title: "Faglig sparring (klinisk beslutningsstøtte)",
            description:
              "Er du i tvivl om en diagnose? Selma analyserer symptomerne og giver dig kvalificerede forslag baseret på evidens.",
          },
          {
            title: "Kontekst-bevidst",
            description:
              "I modsætning til ChatGPT, kender Selma dine journaler. Den ved, at patienten har diabetes og tidligere knæskader, når du spørger om råd.",
          },
          {
            title: "Patientsikkerhed",
            description:
              "Selma scanner dine noter for røde flag og manglende sikkerhedsspørgsmål, så du hurtigt kan afklare det vigtigste i konsultationen.",
          },
        ],
        panel: {
          title: "Selma Copilot",
          overviewTitle: "Klinikoverblik",
          overviewStats: [
            "Dagens patienter: 12",
            "Aktive forløb: 34",
            "Næste opfølgning: 15:30",
          ],
          chat: {
            title: "Selma chat",
            clinicianLabel: "Behandler",
            clinicianMessage:
              "Opsummer Hans' forløb de sidste 3 måneder og giv mig et forslag til statusattest.",
            allyLabel: "Selma",
            allyIntro: "Her er hovedpunkterne til attesten:",
            allyDetails: [
              { label: "Diagnose", value: "Lumbal Discusprolaps (DM511)" },
              {
                label: "Status",
                value: "Smerter reduceret (NRS 8 -> 3). Positiv Lasegue v. 60°.",
              },
              { label: "Plan", value: "4 ugers genoptræning + deltid." },
            ],
            allyOutro:
              "Jeg har oprettet dokumentet. Skal jeg sende det til godkendelse?",
          },
          footerNote: "Sidepanel med Selma er altid tilgængeligt under konsultationen.",
        },
        examples: {
          eyebrow: "Flere eksempler",
          title: "Sådan bruger klinikker Selma i praksis",
          description:
            "Se konkrete scenarier, hvor Selma sparer tid, løfter kvaliteten og holder styr på dokumentationen.",
          items: [
            {
              label: "Statusattest",
              clinician:
                "Opsummer Hans' forløb de sidste 3 måneder og giv mig et forslag til statusattest.",
              ally:
                "Her er et kort udkast: Hans har fulgt 8 behandlingsgange med markant forbedret ROM og reduceret smerte. Anbefaler fortsat træning og opfølgning om 4 uger.",
            },
            {
              label: "Henvisning",
              clinician:
              "Hvad er de 3 mest sandsynlige differentialdiagnoser ?",
              ally:
              "1) Diskogen irritation (fleksionsprovokeret, bedring ved ekstension)\n2) Facetledsrelateret smerte\n3) Gluteal refereret smerte",
            },
            {
              label: "Forsikringsmail",
              clinician:
              "Hvad mangler jeg at afklare i anamnesen?",
              ally:
              "• Forværres symptomer ved host/nys?\n• Stråling under knæ?\n• Morgenstivhedens varighed?\n• Tidligere episoder?\n• Patientens bekymringer/fear avoidance?",
            },
            {
              label: "Klinisk sparring",
              clinician:
              "Har du forslag til næste behandling?",
              ally:
                "Forslag: Fokus på gradueret belastning, core-stabilitet og individuel øvelsesplan. Overvej opfølgning efter 7-10 dage.",
            },
          ],
        },
        activate: {
          title: "Få Selma aktiveret i din klinik",
          description:
            "Selma Copilot aktiveres som et eksklusivt lag oven på dit Selma+ system. Når det er aktivt, kan du spørge, diktere og dokumentere direkte fra journalen.",
          cardTitle: "Eksklusivt AI-lag",
          cardDescription:
            "Klar til at opleve Selma? Kontakt os og få en demo af Selma Copilot.",
          cta: "Book en demo",
        },
      },
      websiteBuilder: {
        whyMatters: {
          imageAlt: "Behandler i gang med patient – aftale booket",
          badge: "Aftale booket",
          eyebrow: "Hvorfor det betyder noget",
          title: "Hvorfor du har brug for online booking til din klinik",
          description:
            "Med Selma+ kan patienter booke selv, mens du behandler. Systemet holder kalenderen opdateret og bekræfter aftalen for dig, så nye bookinger tikker ind uden at forstyrre konsultationen.",
          bullets: [
            "Bookinger tikker ind, mens du behandler – ingen opkald eller afbrydelser.",
            "Fuld integration med dit bookingsystem, så tider og ydelser altid er synkroniseret.",
            "Du bestemmer rammerne: arbejdstider, ydelser og regler for hvornår patienter kan booke.",
          ],
        },
        ai: {
          eyebrow: "SYNLIGHED & VÆKST",
          title: "Mød dine patienter, der hvor de er",
          description:
            "Dit Selma+ bookinglink er din digitale nøgle. Indsæt det nemt på din Instagram-profil eller integrer det på din nuværende hjemmeside. Gør det let for følgere at blive til faste patienter.",
          features: [
            {
              title: "Klar på Instagram & SoMe",
              description:
                "Indsæt linket i din bio under 'Book tid hos mig'. Konverter følgere til bookinger med ét klik.",
            },
            {
              title: "Integrer på din side",
              description:
                "Har du allerede en hjemmeside? Indsæt linket på en knap, så dine besøgende ryger direkte ind i din kalender.",
            },
            {
              title: "Del linket overalt",
              description:
                "Send linket i en SMS, nyhedsbrev eller DM, når patienter spørger. Det har aldrig været nemmere.",
            },
          ],
          imageAlt: "Bookinglink på Instagram og hjemmeside",
          chat: {
            label: "Direkte chat",
            agent: "Selma+ Agent",
            agentMessage: "Hej! Har du spørgsmål til vores behandlinger?",
            patient: "Patient",
            patientMessage: "Behandler I sportsskader?",
          },
        },
        design: {
          eyebrow: "Bygget til klinikker",
          title: "Design den perfekte bookingside med Selma+",
          cardLabel: "Klinikside",
          cardTag: "Ydelser",
          imageAlt: "Patient konsultation",
          cardTitle: "Ydelser og booking",
          serviceItems: [
            "Konsultation",
            "Opfølgende session",
            "Online tjek-ind",
          ],
          cardCta: "Book din tid",
          sideTitle: "Ét system til både brand og kalender",
          sideDescription:
            "Tilpas din Selma+ hjemmeside til din klinik, mens alle bookinger er koblet til din live-kalender.",
          sideBullets: [
            "Match farver, typografi og tone.",
            "Vis alle ydelser eller fremhæv én.",
            "Hold patienter på din side mens de booker.",
            "Opdater ydelser ét sted og hold alt synkroniseret.",
          ],
        },
        growth: {
          eyebrow: "FAIR BETALING",
          title: "Markedets mest fair betalingsløsning til klinikker",
          description:
            "Med SelmaPay betaler du kun de nødvendige transaktionsgebyrer - intet ekstra.\n\nMange kliniksystemer tager højere procenter eller lægger yderligere gebyrer oveni.\nHos Selma+ har vi valgt en mere fair model, så klinikker kan beholde mere af deres omsætning.\n\nVed en klinik med en månedlig omsætning på 40.000 kr og en gennemsnitlig behandlingspris på 500 kr kan forskellen allerede mærkes:",
          cardTitle: "Sammenligning i praksis",
          cardDescription:
            "Regnet med standardeksemplet for en klinik på 40.000 kr i månedlig omsætning.",
          comparison: {
            typicalTitle: "Typisk løsning",
            typicalFee: "1,9% + 1,50 kr pr. betaling",
            selmaTitle: "SelmaPay",
            selmaFee: "1,5% + 1,80 kr pr. betaling",
            savingsTitle: "Besparelse",
            perYear: "om året",
            noHiddenFees: "Ingen skjulte gebyrer. Ingen ekstra platform-fees.",
          },
          calculator: {
            title: "Beregn din besparelse",
            monthlyRevenue: "Månedlig omsætning",
            averagePrice: "Gennemsnitlig behandlingspris",
            typicalAnnual: "Typisk løsning",
            selmaAnnual: "SelmaPay",
            savingsAnnual: "Besparelse",
          },
          cta: "Behold mere af din omsætning med SelmaPay",
          methods: ["MobilePay", "Apple Pay", "Visa", "Mastercard"],
        },
        paymentFlow: {
          eyebrow: "Betalingsflow",
          title: "Se hvordan booking og betaling lander i klinikken",
          description:
            "Patienten betaler {amount} {currency}. Selma+ trækker {percent}% + {fixedFee} {currency} i transaktionsgebyr ({fee} {currency} i alt), og resten lander hos klinikken.",
          stats: {
            patientPays: "Patient betaler {amount} {currency}",
            selmaFee:
              "Selma+ transaktionsgebyr ({percent}% + {fixedFee} {currency}): {fee} {currency}",
            clinicReceives: "Klinik modtager {net} {currency}",
          },
          labels: {
            scenario: "Scenario",
            patient: "Patient",
            selma: "Selma+",
            clinic: "Klinik",
            fee: "Selma+ transaktionsgebyr ({percent}% + {fixedFee} {currency})",
          },
          brandAlt: "Selma+ logo",
          feeBadge: {
            title:
              "Selma+ transaktionsgebyr ({percent}% + {fixedFee} {currency}): {fee} {currency}",
            subtitle: "Til Selma+",
          },
          patient: {
            title: "Patient",
            tag: "Online booking: din klinik",
            timeLabel: "Tid",
            timeValue: "Tirsdag kl. 10:00",
            priceLabel: "Pris",
            status: "Booket og sendt direkte til kalenderen",
          },
          clinic: {
            title: "Klinik modtager",
            note: "Overført direkte til klinikken",
          },
          flow: {
            bookingLabel: "Booking sendes direkte til dit bookingsystem",
            paymentLabel: "Betaling {amount} {currency}",
          },
          phone: {
            systemLabel: "Bookingsystem",
            systemStatus: "Ledigt",
            calendarTitle: "Ledige tider",
            slotLabel: "Ledig tid",
            slotValue: "10:00",
            confirmed: "Booking lagt i kalenderen",
            receiptTitle: "Booking betalt",
            totalLabel: "Betaling",
            feeLabel: "Selma+ transaktionsgebyr ({percent}% + {fixedFee} {currency})",
            feeNote: "Til Selma+",
          },
        },
        builder: {
          eyebrow: "Online booking",
          title: "Din professionelle klinik-side. Klar på få minutter.",
          pill: "100% integreret: Bookinger lander direkte i din kalender.",
          description:
            "Glem teknisk besvær. Selma+ genererer automatisk en smuk bookingside baseret på din profil, så du kan fokusere på dine patienter.",
          imageAlt: "Forhåndsvisning af hjemmesidebygger",
        },
        bookingFlow: {
          eyebrow: "Booking-flow",
          title: "Book din tid hurtigt og trygt",
          viewTag: "Patient-visning",
          steps: ["Behandling", "Ydelse", "Tid & behandler", "Bekræft"],
          weekdays: ["ma", "ti", "on", "to", "fr", "lø", "sø"],
          categories: [
            {
              id: "physio",
              title: "Fysioterapi",
              description: "Smerter, bevægelighed og genoptræning.",
            },
            {
              id: "chiro",
              title: "Kiropraktik",
              description: "Ryg, nakke og holdningsjusteringer.",
            },
            {
              id: "osteopathy",
              title: "Osteopati",
              description: "Helhedsorienteret behandling.",
            },
            {
              id: "sports",
              title: "Sportsbehandling",
              description: "Skader og præstation.",
            },
            {
              id: "mind",
              title: "Psykologisk støtte",
              description: "Stress, angst og mental ro.",
            },
            {
              id: "recovery",
              title: "Restitution",
              description: "Pleje og restitution.",
            },
          ],
          services: {
            physio: [
              { id: "physio-1", name: "Førstegangskonsultation", duration: 45, price: 520 },
              { id: "physio-2", name: "Opfølgende behandling", duration: 30, price: 360 },
              { id: "physio-3", name: "Udvidet behandling", duration: 60, price: 690 },
            ],
            chiro: [
              { id: "chiro-1", name: "Ryganalyse", duration: 40, price: 580 },
              { id: "chiro-2", name: "Justering", duration: 25, price: 420 },
              { id: "chiro-3", name: "Kombi-session", duration: 55, price: 720 },
            ],
            osteopathy: [
              { id: "osteo-1", name: "Helkropsbehandling", duration: 50, price: 610 },
              { id: "osteo-2", name: "Fascie & mobilitet", duration: 35, price: 440 },
              { id: "osteo-3", name: "Dybdeterapi", duration: 60, price: 740 },
            ],
            sports: [
              { id: "sport-1", name: "Skadescreening", duration: 30, price: 390 },
              { id: "sport-2", name: "Præstationstjek", duration: 50, price: 610 },
              { id: "sport-3", name: "Tilbage til sport", duration: 60, price: 760 },
            ],
            mind: [
              { id: "mind-1", name: "Samtaleforløb", duration: 50, price: 720 },
              { id: "mind-2", name: "Akut stress-session", duration: 30, price: 520 },
              { id: "mind-3", name: "Forløbsplan", duration: 60, price: 840 },
            ],
            recovery: [
              { id: "recovery-1", name: "Kropsscanning", duration: 35, price: 360 },
              { id: "recovery-2", name: "Genopladning", duration: 45, price: 520 },
              { id: "recovery-3", name: "Restitution plus", duration: 60, price: 690 },
            ],
          },
          practitioners: [
            {
              id: "practitioner-1",
              name: "Anna Madsen",
              title: "Senior behandler",
              avatar: getPublicAssetUrl("hero-2/physio-hero-01.jpg"),
            },
            {
              id: "practitioner-2",
              name: "Jonas Kragh",
              title: "Fysioterapeut",
              avatar: getPublicAssetUrl("hero-2/physio-hero-02.jpg"),
            },
            {
              id: "practitioner-3",
              name: "Maria Lyng",
              title: "Osteopat",
              avatar: getPublicAssetUrl("hero-2/physio-hero-03.jpg"),
            },
          ],
          step1: {
            title: "Trin 1 · Vælg behandlingstype",
            description: "Vælg det område, der passer bedst til dine behov.",
          },
          step2: {
            title: "Trin 2 · Vælg specifik ydelse",
            description: "Se varighed og pris, og vælg den ydelse der passer bedst.",
          },
          step3: {
            title: "Trin 3 · Vælg tid og behandler",
            description: "Vælg en dato og se ledige tider med din behandler.",
          },
          calendar: {
            selectDate: "Vælg dato",
          },
          step4: {
            title: "Trin 4 · Bekræftelse",
            description:
              "Vælg hvordan du vil bekræfte din tid. Det tager kun et øjeblik.",
            summaryTitle: "Dit valg",
            summaryService: "Behandling",
            summaryTime: "Tid",
            sms: "SMS-kode",
            guest: "Fortsæt som gæst",
            nameLabel: "Navn",
            namePlaceholder: "Dit navn",
            emailLabel: "Email",
            emailPlaceholder: "din@email.dk",
            addressLabel: "Adresse",
            addressPlaceholder: "Gade, postnummer, by",
            phoneLabel: "Telefonnummer",
            phonePlaceholder: "+45 12 34 56 78",
            payment: {
              title: "Betal sikkert med Stripe",
              description:
                "Betalingen gennemføres ved booking, så din tid er sikret. Vi understøtter MobilePay, Apple Pay, Google Pay, Dankort, Visa og Mastercard.",
              payCta: "Gå til betaling",
            },
            smsCta: "Send SMS-kode",
            smsHint: "Vi sender en bekræftelsesbesked til {phone}.",
            phoneFallback: "dit nummer",
            confirmCta: "Bekræft booking",
            confirmHint: "Vi sender en bekræftelse til {email}.",
            emailFallback: "din email",
          },
          actions: {
            select: "Vælg",
            back: "Tilbage",
            next: "Næste trin",
          },
        },
        liveBuilder: {
          images: {
            psychGallery1: "Roligt terapirum",
            psychGallery2: "Samtalerum",
            psychGallery3: "Mental sundhed",
          },
          upload: {
            errors: {
              endpointMissing:
                "Upload endpoint blev ikke fundet. Genstart backend-serveren (npm run server).",
              failedWithStatus: "Upload mislykkedes ({status}).",
              missingUrl: "Upload mislykkedes: mangler foto-URL.",
              generic: "Upload mislykkedes.",
              network:
                "Kunne ikke nå backend-serveren. Start den med: npm run server",
            },
          },
          generate: {
            error: "Kunne ikke generere forhåndsvisning.",
          },
          previewIntro: {
            title: "Prøv det nu: Se din fremtidige side med det samme",
            description:
              "Indtast dine oplysninger nedenfor, og se hvordan patienterne vil møde dig online.",
          },
          eyebrow: "Online booking",
          titlePrefix: "Se din",
          titleHighlight: "fremtidige klinikside",
          titleSuffix: "live",
          steps: {
            questions: "3-6 spørgsmål",
            preview: "forhåndsvisning",
            previewSuffix: "på få sekunder",
            save: "gem",
            saveSuffix: "når du er klar",
          },
          note: {
            primary:
              "Du kan uploade dine egne billeder. Hvis du ikke har dem klar, kan vi generere billeder for dig.",
            secondary:
              "Forhåndsvisningen er kun et udkast. Den endelige online booking side bliver færdiggjort af professionelle webbyggere.",
          },
          badges: {
            restored: "Udkast gendannet",
            loginRequired: "Log ind er påkrævet for at gemme",
          },
          actions: {
            edit: "Rediger",
            savePublish: "Gem & udgiv",
            generateAgain: "Generér igen",
            generate: "Generér på 20 sek",
            generating: "Genererer...",
          },
          form: {
            clinicName: "Kliniknavn",
            clinicNamePlaceholder: "f.eks. Klinik Nord",
            profession: "Profession",
            professionPlaceholder: "f.eks. Fysioterapeut",
            practitionerName: "Dit navn",
            practitionerNamePlaceholder: "f.eks. Mette Jensen",
            yearsExperience: "Års erfaring",
            yearsExperiencePlaceholder: "f.eks. 8",
            targetAudience: "Hvem hjælper du typisk?",
            targetAudiencePlaceholder:
              "f.eks. stress, angst, smerter, sportsskader",
            approach: "Din tilgang",
            approachPlaceholder:
              "f.eks. evidensbaseret, rolig og præcis",
            serviceLabel: "Ydelse {index}",
            servicePlaceholderPrimary: "f.eks. Skadebehandling",
            servicePlaceholderSecondary: "f.eks. Rehabilitering",
            aboutBulletLabel: "Om mig - punkt {index}",
            aboutBulletPlaceholderPrimary: "f.eks. Specialiseret i ...",
            aboutBulletPlaceholderSecondary: "f.eks. Fokus på ...",
            city: "By",
            cityPlaceholder: "f.eks. Aarhus",
            tone: "Tone",
            toneOptions: {
              professionalCalm: "professionel/rolig",
              warmEmpathetic: "varm/empatisk",
              energeticMotivating: "energisk/motiverende",
              expertClinical: "ekspert/klinisk",
            },
            languages: "Sprog",
            languagesPlaceholder: "f.eks. Dansk, Engelsk",
            aboutPhoto: "Om mig - foto",
            photoAlt: "Billede af dig",
            photoUrlPlaceholder: "/uploads/... eller https://...",
            photoUploading: "Uploader foto...",
          },
          footerNote: "Vi gemmer et udkast lokalt. Gem kræver login.",
        },
        preview: {
          draft: {
            title: "Udkast til online booking",
            description:
              "Har du egne billeder, kan du indsætte dem direkte. Hvis du ikke har billeder klar, kan Selma+ generere dem for dig.",
            note: "Det færdige resultat bliver udarbejdet af professionelle webbyggere.",
          },
          chat: {
            headerLabel: "Direkte chat",
            headerTitle: "Selma+ Reception",
            welcome: "Velkommen til {clinicName}, hvad kan jeg hjælpe med?",
            clinicFallback: "din klinik",
            roles: {
              user: "Patient",
              assistant: "Reception",
            },
            inputPlaceholder: "Skriv en besked...",
            send: "Send",
            errorFallback: "Noget gik galt. Prøv igen.",
          },
          empty: {
            title: "Forhåndsvisning",
            heading: "Din klinikside vises her",
            description: "Udfyld felterne og tryk “Generér på 20 sek”.",
          },
          hero: {
            headline: "Professionel behandling for hele familien",
            supportingText:
              "Oplev omsorgsfuld, personlig behandling med en klinik der sætter dig først.",
            ctaPrimary: "Book tid",
            ctaSecondary: "Ring nu",
            imageAlt: "Moderne klinik",
            secondaryImageAlt: "Behandling i klinikken",
            badge: "Åbent for nye patienter",
            availabilityLabel: "Tilgængelig",
          },
          heroStats: [
            { value: "15+", label: "Års erfaring" },
            { value: "2k+", label: "Tilfredse patienter" },
            { value: "4.9", label: "Patientrating" },
          ],
          navLinks: ["Om mig", "Terapiformer", "Klinikken"],
          templateLabel: "Skabelon",
          about: {
            eyebrow: "Om mig",
            photoAlt: "Portræt",
            photoAltNamed: "Portræt af {name}",
            bulletsTitle: "Om mig",
            credentialsTitle: "Uddannelse & Certificeringer",
          },
          gallery: {
            title: "Klinikken",
            imageAlt: "Billede",
          },
          sections: {
            services: "Ydelser",
            serviceFallback: "Ydelse",
            trust: "Tryghed",
            contact: "Kontakt",
            contactAddress: "Adresse",
            contactPhone: "Telefon",
            contactEmail: "Email",
            booking: "Booking",
          },
        },
      },
      workflow: {
        eyebrow: "Funktioner",
        title: "Transkribering og diktering - sådan bruger du det i journalen",
        description:
          "Vi viser præcis den arbejdsgang, du møder inde i journalen - gjort klar til forsiden, så det er nemt at forstå.",
        ariaLabel: "Selma+ journal-funktioner",
        tabTag: "Journal",
        tabs: [
          {
            id: "transcription",
            label: "Transkribering",
            title: "Direkte transkribering i journalen",
            description:
              "Selma+ lytter med og skriver samtalen ned, mens du behandler. Du får et ryddeligt transkript uden ekstra klik.",
            bullets: [
              "Speaker-adskillelse og tydelige markeringer",
              "Seneste sætninger ligger klar til gennemgang",
              "Skabt til kliniske noter og ro i rummet",
            ],
          },
          {
            id: "facts",
            label: "Diktering",
            title: "Dikter kliniske noter direkte ind i journalen",
            description:
              "Indtal dit notat som behandler - hurtigt, præcist og i et sprog der passer til klinisk dokumentation. Perfekt efter konsultationen, når du vil have din vurdering, konklusion og plan ned uden at skrive det hele manuelt.",
            bullets: [
              "Skabt til kliniske vurderinger",
              "Journal-klar tekst med minimal efterredigering",
              "Struktureret output i skabelon",
            ],
          },
        ],
        badge: {
          facts: "Diktering i journalen",
          transcription: "Direkte transkribering",
        },
        panel: {
          titleFacts: "Diktering",
          titleTranscription: "Direkte transkript",
          subtitleFacts: "Drevet af Corti",
          subtitleTranscription: "Sikker lyd optagelse",
          liveBadge: "Direkte",
          record: "Optag",
          recordingStatus: "Optager i baggrunden",
        },
        sample: {
          whisperText:
            "Behandler: Hvordan har skulderen været siden sidst?\n\nPatient: Den er bedre, men stadig stram ved løft.\n\nBehandler: Vi tester ROM og justerer øvelserne.\n\nPatient: Det lyder godt.",
          facts: [
            { id: "f-1", text: "Smerter i højre skulder ved løft", groupKey: "anamnesis" },
            { id: "f-2", text: "Debut for 3 uger siden efter havearbejde", groupKey: "anamnesis" },
            { id: "f-3", text: "Nedsat ROM ved abduktion", groupKey: "objective" },
            { id: "f-4", text: "Palpationsømhed omkring deltoideus", groupKey: "objective" },
            { id: "f-5", text: "Træningsprogram 2x/uge", groupKey: "plan" },
            { id: "f-6", text: "Opfølgning om 2 uger", groupKey: "plan" },
          ],
          transcripts: [
            { id: "t-1", transcript: "Patienten angiver smerter ved løft.", final: true },
            { id: "t-2", transcript: "Tester ROM og planlægger øvelser.", final: true },
            { id: "t-3", transcript: "Opfølgning om to uger.", final: false },
          ],
        },
        factsPanel: {
          title: "FactsR",
          poweredBy: "Drevet af Corti",
          groupFallback: "Andet",
          status: {
            connecting: "Forbinder...",
            streaming: "Direkte",
            finalizing: "Afslutter...",
            ended: "Afsluttet",
            error: "Fejl",
            idle: "Klar",
          },
          record: {
            start: "Optag",
            stop: "Stop optagelse",
          },
          interaction: "Interaktion:",
          latest: "Seneste",
          insertBarLabel: "Indsæt i journal",
          insertBarTitle: "Indsæt i journal:",
          insertTargets: {
            auto: "Auto",
            anamnesis: "Anamnese",
            conclusionFocus: "Fokusområder",
            conclusionContent: "Sessionens indhold",
            conclusionTasks: "Opgaver",
            conclusionReflection: "Refleksion",
            combined: "Samlet",
          },
          insertSelected: "Indsæt i journal",
          insertSelectedTitle: "Indsæt de markerede fakta",
          insertAll: "Indsæt alle",
          insertAllTitle: "Indsæt alle fakta i valgt felt",
          tabs: {
            facts: "Fakta",
            transcript: "Transkript",
          },
          actions: {
            flush: "Opdater",
            clear: "Ryd",
          },
          item: {
            select: "Marker",
            recommended: "Anbefalet",
            insert: "Indsæt",
            insertTitle: "Indsæt denne sætning i valgt felt",
          },
          empty: {
            facts:
              "Ingen fakta endnu. Typisk kommer de første fakta efter ca. 60 sek. Brug dem som forslag og gennemgå altid klinisk.",
            transcript: "Ingen transkript endnu.",
          },
          meta: {
            source: "kilde",
            discarded: "kasseret",
          },
          groups: {
            anamnesis: "Anamnese",
            objective: "Fund",
            plan: "Plan",
          },
        },
        whisper: {
          ariaLabel: "Whisper transskription",
          title: "Whisper transskription",
          subtitle: "Seneste data fra transskription",
          excerptTitle: "Tekstuddrag",
          placeholder: "Ingen tekst tilgængelig.",
          usageTitle: "Tokenforbrug",
          usageType: "Klinisk",
          usageLabels: {
            type: "Type",
            input: "Input",
            output: "Output",
            total: "Total",
            textTokens: "Teksttokens",
            audioTokens: "Lydtokens",
          },
        },
      },
    },
    login: {
      title: "Login / Sign up",
      description:
        "Log ind eller opret en konto med email og kodeord. Du kan også fortsætte med Google.",
      form: {
        emailLabel: "Email",
        emailPlaceholder: "Indtast din email",
        passwordLabel: "Kodeord",
        passwordPlaceholder: "Indtast dit kodeord",
        confirmPasswordLabel: "Bekræft kodeord",
        confirmPasswordPlaceholder: "Indtast dit kodeord igen",
        methodLabel: "Login metode",
        methodEmail: "Email",
        methodPhone: "Telefon",
        methodEmployee: "Behandler",
        phoneLabel: "Telefon",
        phonePlaceholder: "+45 12 34 56 78",
        phoneHelper: "Du modtager en SMS-kode. Standardtakster kan gælde.",
        usernameLabel: "Brugernavn",
        usernamePlaceholder: "Indtast dit brugernavn",
        employeeHelper:
          "Vælg Behandler og log ind med det brugernavn, klinikken har oprettet til dig.",
        sendCode: "Send kode",
        smsCodeLabel: "Verifikationskode",
        smsCodePlaceholder: "6 cifre",
        confirmCode: "Bekræft & log ind",
        remember: "Hold mig logget ind",
        resetPassword: "Nulstil kodeord",
        signIn: "Log ind",
        orContinue: "Eller fortsæt med",
        google: "Fortsæt med Google",
        loginLink: "Login",
        signUpLink: "Sign up",
      },
      testimonials: {
        avatarAlt: "Profilbillede",
      },
      status: {
        loggedIn: "Du er nu logget ind. Klargør din konto...",
        signingIn: "Logger ind...",
        codeSent: "Kode sendt. Tjek din SMS.",
        resetSent: "Nulstilling sendt. Tjek din indbakke.",
      },
      errors: {
        google: "Google-login mislykkedes.",
        emailConfirmationRequired:
          "Emailbekræftelse er påkrævet for at fuldføre login.",
        emailLinkFailed: "Kunne ikke fuldføre login-link.",
        emailPasswordRequired: "Indtast både email og kodeord.",
        wrongPassword: "Forkert kodeord. Prøv igen.",
        weakPassword: "Kodeordet er for svagt. Brug mindst 6 tegn.",
        invalidEmail: "Ugyldig email. Tjek stavning og prøv igen.",
        emailInUse:
          "Emailen findes allerede. Prøv at logge ind med dit kodeord.",
        authFailed: "Kunne ikke logge ind eller oprette bruger.",
        phoneMissing: "Indtast dit telefonnummer.",
        phoneInvalid: "Ugyldigt telefonnummer. Brug formatet +45 12345678.",
        tooManyRequests: "For mange forsøg. Prøv igen senere.",
        recaptchaFailed: "reCAPTCHA fejlede. Prøv igen.",
        recaptchaInit: "Kunne ikke starte reCAPTCHA. Prøv igen.",
        phoneSendFailed: "Kunne ikke sende SMS-kode.",
        codeMissing: "Indtast verifikationskoden.",
        codeInvalid: "Forkert verifikationskode.",
        codeExpired: "Koden er udløbet. Send en ny kode.",
        phoneLoginFailed: "Kunne ikke logge ind med telefon.",
        employeeUsernameRequired: "Indtast dit brugernavn.",
        employeeLoginFailed: "Kunne ikke logge ind som behandler.",
        signupFieldsRequired: "Indtast email, kodeord og bekræft kodeord.",
        passwordMismatch: "Kodeordene matcher ikke.",
        providerMismatch:
          "Denne konto findes med en anden login-metode. Log ind med den oprindelige metode.",
        emailPasswordFirst: "Indtast email og kodeord først.",
        userNotFound:
          "Email findes ikke. Tryk på 'Opret konto' for at oprette en bruger.",
        loginFailed: "Kunne ikke logge ind.",
        signupFailed: "Kunne ikke oprette eller logge ind.",
        resetMissingEmail:
          "Indtast din email først, og vælg derefter nulstil kodeord.",
        resetFailed: "Kunne ikke sende nulstillingsmail.",
      },
      prompt: {
        confirmEmail: "Bekræft din email for at logge ind",
      },
      aria: {
        backHome: "Tilbage til forsiden",
      },
    },
  },
  en: {
    navbar: {
      cta: {
        booking: "Go to app",
        tryFree: "Try free",
      },
      languageLabel: "Select language",
      languages: {
        danish: "Danish",
        english: "English",
      },
      logo: {
        tagline: "For clinics that want more",
      },
      menu: {
        solutions: {
          title: "Solutions",
          itemsHeader: "For clinics",
          items: {
            individuals: {
              title: "Solo practitioners",
              description: "All-in-one for independent clinicians.",
            },
            smallBusiness: {
              title: "Small clinics",
              description: "Scheduling, documentation, and finance together.",
            },
          },
          featured: {
            title: "Build your clinic",
            description: "Booking, documentation, and AI in one system.",
            alt: "Selma+ overview",
          },
        },
        features: {
          title: "Features",
          itemsHeader: "Explore",
          items: {
            transcription: { title: "Transcription & dictation" },
            copilot: { title: "Selma Copilot" },
            website: { title: "Online booking & payments" },
          },
        },
        professions: {
          title: "Professions",
          itemsHeader: "Built for",
          itemsNote: "More specialties coming soon.",
          items: {
            physio: "Physiotherapy",
            osteo: "Osteopathy",
            chiro: "Chiropractic",
          },
        },
        pricing: { title: "Pricing" },
        about: { title: "About us" },
      },
    },
    common: {
      back: "Back",
      close: "Close",
      brand: "Selma+",
      brandName: "Selma",
      brandShort: "S+",
      ai: "AI",
      soap: "SOAP",
      placeholder: "—",
      availabilityValue: "24/7",
      units: {
        minutes: "min",
        currency: "DKK",
      },
    },
    landing: {
      divider: {
        text: "FROM PHYSIOS TO PHYSIOS",
        aria: "Section divider",
      },
      frontpage: {
        titleLine1: "Supercharge Your Practice",
        titleLine2: "With Selma+",
        subtitle:
          "Booking, documentation, and your clinical assistant — all in one system.",
        ctaPrimary: "Get started free",
        ctaSecondary: "See demo",
      },
      heroDevices: {
        eyebrow: "Selma+ platform",
        title: "The overview that comes to you.",
        description:
          "Forget clicking around for information before the next consultation. When a patient approaches, Selma+ automatically serves everything for you: who is coming, an AI summary of the last session, and a clear plan for today. You're ready before the patient walks in the door.",
        cta: "Try Selma+ booking",
        hint: "No installation. Watch the demo in 2 minutes.",
      },
      heroJournal: {
        eyebrow: "Selma+ platform",
        title: "The overview that comes to you.",
        description:
          "Forget clicking around for information before the next consultation. When a patient approaches, Selma+ automatically serves everything for you: who is coming, an AI summary of the last session, and a clear plan for today. You're ready before the patient walks in the door.",
        cta: "Try Selma+ booking",
        hint: "No installation. Watch the demo in 2 minutes.",
        videoTitles: {
          dictation: "Dictation",
          transcriptionFirstConsultation: "Transcription - Initial Consultation",
        },
      },
      aboutSection: {
        statsLine: "A new chapter. Built for practitioners.",
        rightHeadline: "Built with\nclinics.",
        rightSubline: "Shaped by real-world feedback.",
        title: "From clinical everyday work to an intelligent platform.",
        paragraphOne:
          "Selma+ was founded because the systems that existed never fully met our needs. At the same time, we saw how technology and AI were transforming the world around us.",
        paragraphTwo:
          "Selma+ brings booking, documentation, and intelligent clinical support together in one modern platform, shaped by real-world feedback and designed for the healthcare professionals of the future.",
        foundersName: "Designed in Denmark.",
        foundersRole: "Created by physiotherapists.",
        ctaPrompt: "Ready to bring everything together in one modern system?",
        ctaButton: "Explore Selma+",
      },
      manifesto: {
        line1:
          "We found that a professional system doesn't have to cost a fortune.",
        line2: "No expensive websites. No heavy IT systems.",
        line3: "We chose to build it ourselves, because we knew we could do it better.",
        line4: "Welcome to Selma+.",
      },
      demo: {
        words: "A calm clinical flow - from booking to documentation to follow-up.",
        timeline: [
          {
            title: "Get started fast",
            date: "Day 1",
            category: "Setup",
            content:
              "Add staff, services, and opening hours in minutes.",
          },
          {
            title: "Bookings roll in",
            date: "Week 1",
            category: "Booking",
            content: "Patients book online and the calendar fills automatically.",
          },
          {
            title: "Documentation in flow",
            date: "Week 2",
            category: "Journal",
            content: "Transcription and FactsR help you capture notes.",
          },
          {
            title: "Operations stay calm",
            date: "Week 3",
            category: "Operations",
            content: "Invoicing, follow-ups, and insights are unified.",
          },
        ],
      },
      parallax: {
        sections: {
          collaborate: {
            subheading: "Collaborate in flow",
            heading: "All your data in one system",
          },
          quality: {
            subheading: "Quality in every session",
            heading: "Secure documentation without extra clicks",
          },
        },
      },
      globeFeature: {
        title: "Created by physiotherapists. Built for modern clinics.",
        subtitle:
          "Cheaper and smarter clinic software with integrated AI - without extra modules, hidden fees, or unnecessary administration.",
        cta: "Get started today",
      },
      statsSection: {
        title: "Freedom is closer than you think.",
        description:
          "Today only a small share of Nordic practitioners work independently. Why? Because administration has been a bottleneck. We built Selma+ to remove that barrier so you can focus on what you do best.",
        cta: "Be part of the future ->",
        stats: [
          { label: "EU average", flag: "🇪🇺", value: "13%", note: "Rising trend" },
          { label: "Denmark", flag: "🇩🇰", value: "7.4%", note: "Large potential" },
          { label: "Norway", flag: "🇳🇴", value: "3.9%", note: "Untapped market" },
          { label: "Sweden", flag: "🇸🇪", value: "8.5%", note: "Growing" },
        ],
        slides: [
          {
            title: "Secure clinic data in the EU",
            text:
              "All data in Selma+ is stored on secure servers in the EU and processed under GDPR. Records, appointments, and personal data are encrypted both in transit and at rest. Access is controlled with secure logins and role-based permissions, so only the right people see what they need. You always own your data and can export or delete it. In short: clinic data in one place, safe and compliant.",
            image: getPublicAssetUrl("hero-2/pexels-eberhardgross-1743364.jpg"),
            alt: "Secure clinic data storage in the EU",
          },
          {
            title: "More presence in the consultation",
            text:
              "Selma+ makes it easier to stay present with the patient instead of the screen. Notes are captured via templates, shortcuts, and optional speech-to-text, so documentation does not steal the conversation. The system structures the information and can summarize the course afterward, so you get a quick overview. You spend less energy on the keyboard and more on listening, examining, and explaining - without compromising clinical quality.",
            image: getPublicAssetUrl("hero-2/pexels-shkrabaanthony-5217850.jpg"),
            alt: "More presence in the consultation",
          },
          {
            title: "Overview without admin chaos",
            text:
              "With Selma+, you avoid admin chaos and get a system that works for you. Appointments, reminders, records, and key metrics are gathered in one place and updated automatically. The platform helps you track patient progress and can suggest the next clinical step. You save time, reduce errors, and get better decision support so you can focus on what matters most: delivering the best possible care.",
            image: getPublicAssetUrl("hero-2/pexels-thirdman-5060985.jpg"),
            alt: "Unified overview and less administration",
          },
        ],
      },
      heroCards: {
        title: "Build your clinic with Selma+",
        description:
          "One platform for booking, documentation, and operations - with AI that helps at every step.",
        subtitle: "Everything clinical, in one calm flow.",
        ctaPrimary: "See demo",
        ctaSecondary: "Get started",
        cards: {
          digitalReception: {
            label: "Digital reception",
            widgetTitle: "Selma+ Reception",
            message: "Welcome to Selma Clinic, how can I help?",
            inputPlaceholder: "Type a message...",
            send: "Send",
            title: "Your clinic is always open",
            description:
              "Get a beautiful website with an AI receptionist built in. It welcomes new patients and answers questions around the clock - even while you sleep.",
            cta: "See the solution",
          },
          intelligentSystem: {
            label: "Intelligent system",
            calendar: "Calendar",
            journal: "Journal",
            title: "More time for treatment",
            description:
              "Stop clicking around. In Selma+, your calendar and journal are unified, and the AI assistant helps you write notes fast.",
            ctaPrimary: "Explore the system",
            ctaSecondary: "Meet Ally",
          },
          overview: {
            label: "Overview",
            metricLabel: "Revenue",
            status: "Status: All reconciled",
            title: "Confidence in the numbers",
            description:
              "Skip the manual hassle. Invoicing, reporting, and accounting run automatically in the background.",
            cta: "See features",
          },
        },
      },
      footer: {
        columns: {
          landing: {
            title: "Landing",
            items: {
              hero: "Home",
              platform: "Platform",
              workflow: "Overview",
              about: "About Selma+",
              stats: "Stats",
              pricing: "Pricing",
            },
          },
          features: {
            title: "Features",
            items: {
              transcription: "Transcription & dictation",
              copilot: "Selma Copilot",
              website: "Online booking & payments",
            },
          },
          about: {
            title: "About",
            items: {
              company: "Company",
              pricing: "Pricing",
              linkedin: "LinkedIn",
            },
          },
        },
      },
    },
    pricing: {
      title: "Everything your clinic needs - in one platform",
      description:
        "Booking, journaling, AI assistant, and payments in one place.\nNo modules. No hidden fees.",
      switch: {
        monthly: "Monthly billing",
        yearly: "Yearly billing",
        savings: "Save 20%",
      },
      planTitle: "{name}",
      labels: {
        popular: "Most popular",
        year: "year",
        month: "month per practitioner",
        features: "Features",
        contactForPrice: "Contact for pricing",
      },
      secondaryCta: "Contact sales",
      trust: ["No lock-in period", "Free onboarding", "Danish support"],
      plans: {
        starter: {
          name: "Selma+ Plan",
          description: "A complete clinic platform for modern practitioners.",
          buttonText: "Get started",
          priceNote: "Everything included",
          includes: [
            "Included:",
            "Online booking page for patients",
            "Calendar with booking overview",
            "Patient journaling",
            "Unlimited patients and treatments",
            "AI transcription of consultations",
            "Dictation directly into journal notes",
            "Selma Assistant in the journal",
            "– suggests objective tests",
            "– identifies red flags",
            "– suggests exercises",
            "– helps with journal structure",
            "Journal templates",
            "Dedicated onboarding",
            "Team features (multiple practitioners can work in the same system)",
            "Patient database",
            "SelmaPay - accept payments from patients (card, MobilePay, Apple Pay, Google Pay)",
          ],
          featureNote:
            "Payments via SelmaPay only include standard transaction fees\n(approx. 1.5% + DKK 1.80 per payment).\n\nSelma+ adds no extra platform fees.",
        },
        enterprise: {
          name: "Enterprise",
          description: "For larger clinics with multiple practitioners or locations.",
          buttonText: "Contact us",
          includes: [
            "Included:",
            "Unlimited users",
            "Multiple clinic locations",
            "Advanced roles and access control",
            "Integrations and API",
            "Dedicated onboarding",
          ],
        },
      },
    },
    features: {
      intelligentBooking: {
        ctaTryFree: "Try free",
        hero: {
          eyebrow: "Intelligent booking",
          title: "Bookings that fill your calendar for you",
          description:
            "Selma+ makes it easy for patients to book and gives you real-time visibility.",
          meta: "No commitment - ready in minutes",
          panelTitle: "Live calendar",
          panelStatus: "Updating",
          teamView: "Team view",
          aiSuggestions: {
            label: "AI suggestions",
            title: "Suggest next slot",
            description:
              "Selma+ finds the best time and keeps utilization high.",
          },
          teamMembers: ["Jonas", "Sofie", "Emma"],
        },
        visualOverview: {
          eyebrow: "Visual overview",
          title: "Plan your team without spreadsheets",
          description:
            "See availability and workload across your clinicians.",
          bullets: [
            "Drag-and-drop scheduling",
            "See utilization per clinician",
            "Keep waitlists moving",
            "Communicate directly with patients",
          ],
          panelTitle: "Weekly calendar",
          panelTag: "Team",
          panelNote: "See workload and open slots at a glance.",
          teamLabels: ["Lina", "Jonas", "Mette"],
        },
        journal: {
          panelTitle: "Live journal",
          voiceRecording: "Voice recording",
          transcriptLabel: "Transcript",
          transcriptText:
            "Patient: Pain has decreased since last session and mobility is better.",
          soapItems: [
            "S: Pain reduced",
            "O: Improved ROM",
            "A: Functional progress",
            "P: Adjust exercises",
          ],
          eyebrow: "Journal & AI",
          title: "Notes without the admin load",
          description:
            "Transcription and FactsR help you document quickly and accurately.",
          cta: "See FactsR",
          bullets: [
            "Automatic SOAP suggestions",
            "Secure storage and sharing",
            "Less time spent documenting",
          ],
        },
        copilotCallout: {
          eyebrow: "Selma Copilot",
          title: "Get an AI colleague in the journal",
          description:
            "Ally suggests next steps, summarizes, and keeps you on track.",
          cta: "See Selma Copilot",
        },
        business: {
          eyebrow: "Business",
          title: "More revenue with less admin",
          description:
            "Track the KPIs that matter without adding another system.",
          revenue: {
            label: "Revenue",
            value: "1,100,000 DKK",
            delta: "+8% last 30 days",
          },
          kpi: {
            label: "KPIs",
            items: {
              utilization: "Utilization",
              returning: "Returning patients",
              growth: "Growth",
            },
            note: "Updated automatically every day",
          },
        },
      },
      operations: {
        ctaTryFree: "Try free",
        hero: {
          eyebrow: "Operations & finance",
          title: "Stay on top of finance and operations",
          description:
            "Selma+ brings payments, reporting, and team management into one calm hub.",
          meta: "No commitment - ready in minutes",
          panelTitle: "Clinic overview",
          panelStatus: "Live",
          revenueLabel: "Revenue",
          revenueValue: "112,540 DKK",
          revenueDelta: "+12% this month",
          reconcileLabel: "Reconciliation",
          reconcileTitle: "All matched",
          reconcileDescription:
            "Payouts and card payments reconcile automatically.",
        },
        finance: {
          eyebrow: "Finance",
          title: "Payments and reporting without the hassle",
          cards: {
            billing: {
              title: "Payments",
              description: "Cards, MobilePay, and invoices in one place.",
            },
            integrations: {
              title: "Integrations",
              description: "Sync with accounting and bank feeds.",
            },
            analytics: {
              title: "Insights",
              description: "Track revenue, utilization, and trends.",
            },
          },
          integrations: ["e-conomic", "Dinero", "Bank", "Stripe"],
        },
        team: {
          eyebrow: "Team",
          title: "Keep the clinic coordinated",
          description:
            "Plan staff, rooms, and resources without spreadsheets.",
          bullets: [
            "Schedule shifts and rooms",
            "Shared calendar for the whole team",
            "Automatic tasks and follow-ups",
          ],
          panelTitle: "Team overview",
          panelTag: "This week",
          panelMembers: ["Jonas", "Emma", "Lars"],
          panelNote: "Drag and drop to move shifts and rooms.",
        },
        programs: {
          panelTitle: "Programs",
          panelTag: "Active",
          panelName: "Sport Rehab",
          panelPasses: "8 of 12 sessions",
          panelSessionLabel: "Next session",
          panelSessionTime: "Thursday 2:00 PM",
          panelProgramLabel: "Program",
          panelProgramValue: "Rehab plan",
          eyebrow: "Programs",
          title: "Track programs and passes",
          description:
            "See remaining sessions, attendance, and progress across patients.",
        },
      },
      transcriptionFactsr: {
        hero: {
          badge: "Premium",
          eyebrow: "Transcription & FactsR",
          title: "Get clinical notes automatically",
          description:
            "Selma+ listens, transcribes, and structures the conversation so you can focus on the patient.",
          ctaPrimary: "Try free",
          ctaSecondary: "See workflow",
          pillTranscription: "Live transcription",
          pillFactsr: "FactsR clinical facts",
        },
      },
      selmaCopilot: {
        ctaTryFree: "Try the system free",
        hero: {
          badge: "Premium",
          badgeLabel: "Selma Copilot",
          title: "Selma Copilot: Never alone in the clinic again.",
          descriptionIntro: "Meet",
          assistantName: "Selma",
          descriptionOutro:
            ". Your intelligent colleague who knows your patients, remembers guidelines, and always has time to help.",
          tagline: "The AI layer that makes Selma+ your most experienced colleague.",
        },
        alwaysOn: {
          eyebrow: "Selma, your AI agent",
          title: "Selma is always ready in the side panel.",
          description:
            "Selma Copilot runs as a side panel so you can ask for guidance, get drafts, and secure documentation without leaving the patient.",
        },
        features: [
          {
            title: "Clinical decision support",
            description:
              "Unsure about a diagnosis? Selma analyzes symptoms and suggests evidence-based options.",
          },
          {
            title: "Context aware",
            description:
              "Unlike chatbots, Selma knows your records. It sees diabetes and previous knee injuries when you ask for guidance.",
          },
          {
            title: "Administrative ninja",
            description:
              "Ask Selma to write referrals, summarize long treatments, or draft insurance emails in seconds.",
          },
        ],
        panel: {
          title: "Selma Copilot",
          overviewTitle: "Clinic overview",
          overviewStats: [
            "Patients today: 12",
            "Active programs: 34",
            "Next follow-up: 3:30 PM",
          ],
          chat: {
            title: "Selma chat",
            clinicianLabel: "Clinician",
            clinicianMessage:
              "Summarize Hans' last 3 months and draft a status report.",
            allyLabel: "Selma",
            allyIntro: "Here are the main points for the report:",
            allyDetails: [
              { label: "Diagnosis", value: "Lumbar disc herniation (DM511)" },
              {
                label: "Status",
                value: "Pain reduced (NRS 8 -> 3). Positive Lasegue at 60°.",
              },
              { label: "Plan", value: "4-week rehab + part-time work." },
            ],
            allyOutro: "Draft created. Should I send it for approval?",
          },
          footerNote: "Selma's side panel is always available during sessions.",
        },
        examples: {
          eyebrow: "More examples",
          title: "How clinics use Selma in practice",
          description:
            "See concrete scenarios where Selma saves time, lifts quality, and keeps documentation on track.",
          items: [
            {
              label: "Status report",
              clinician:
                "Summarize Hans' last 3 months and draft a status report.",
              ally:
                "Quick draft: Hans completed 8 sessions with improved ROM and reduced pain. Recommend continued training and follow-up in 4 weeks.",
            },
            {
              label: "Referral",
              clinician: "Write an MRI referral for Mette with suspected meniscus injury.",
              ally:
                "Referral ready: Mette, 34, knee pain on load and locking. Positive clinical test. Request MRI for clarification.",
            },
            {
              label: "Insurance email",
              clinician: "Draft a short email to insurance about Anders’ treatment status.",
              ally:
                "Email draft: Anders completed 6 sessions. Function improved 30%. Recommend 3 additional treatments for lasting effect.",
            },
            {
              label: "Clinical guidance",
              clinician: "Any suggestions for next treatment for a patient with chronic low back pain?",
              ally:
                "Suggestion: Focus on graded load, core stability, and a tailored exercise plan. Consider follow-up in 7-10 days.",
            },
          ],
        },
        activate: {
          title: "Activate Selma in your clinic",
          description:
            "Selma Copilot is a premium layer on top of your Selma+ system. When activated, you can ask, dictate, and document directly in the journal.",
          cardTitle: "Premium AI layer",
          cardDescription:
            "Ready to experience Selma? Contact us for a Selma Copilot demo.",
          cta: "Book a demo",
        },
      },
      websiteBuilder: {
        whyMatters: {
          imageAlt: "Clinician treating a patient – appointment booked",
          badge: "Appointment booked",
          eyebrow: "Why it matters",
          title: "Why you need a Selma+ booking website",
          description:
            "With Selma+, patients can book on their own while you stay focused on treatment. The system keeps your calendar in sync and confirms appointments so new bookings roll in without interrupting the session.",
          bullets: [
            "Bookings roll in while you treat—no calls or interruptions.",
            "Full integration with your booking system keeps services and slots synced.",
            "You set the rules: working hours, services, and when patients can book.",
          ],
        },
        ai: {
          eyebrow: "VISIBILITY & GROWTH",
          title: "Meet patients where they are",
          description:
            "Your Selma+ booking link is your digital key. Add it to your Instagram bio or embed it on your existing website. Make it effortless for followers to become recurring patients.",
          features: [
            {
              title: "Ready for Instagram & social",
              description:
                "Add the link in your bio under 'Book with me'. Convert followers to bookings in one tap.",
            },
            {
              title: "Embed on your site",
              description:
                "Already have a website? Put the link behind a button so visitors jump straight into your calendar.",
            },
            {
              title: "Share it anywhere",
              description:
                "Send the link via SMS, newsletter, or DM when patients ask. It’s never been easier.",
            },
          ],
          imageAlt: "Booking link on Instagram and website",
          chat: {
            label: "Live chat",
            agent: "Selma+ Agent",
            agentMessage: "Hi! Do you have questions about our treatments?",
            patient: "Patient",
            patientMessage: "Do you treat sports injuries?",
          },
        },
        design: {
          eyebrow: "Built for clinics",
          title: "Design the perfect booking website with Selma+",
          cardLabel: "Clinic website",
          cardTag: "Services",
          imageAlt: "Patient consultation",
          cardTitle: "Services and booking",
          serviceItems: [
            "Consultation",
            "Follow-up session",
            "Online check-in",
          ],
          cardCta: "Book your appointment",
          sideTitle: "One system for your brand and your calendar",
          sideDescription:
            "Customize your Selma+ website while every booking stays connected to your live schedule.",
          sideBullets: [
            "Match your colors, typography, and tone of voice.",
            "Show all appointment types or spotlight one service.",
            "Keep patients on your site while they book.",
            "Update services once in Selma+ and stay in sync.",
          ],
        },
        growth: {
          eyebrow: "FAIR PAYMENTS",
          title: "The fairest payment solution for clinics",
          description:
            "With SelmaPay, you only pay the necessary transaction fees - nothing extra.\n\nMany clinic systems charge higher percentages or add extra fees on top.\nAt Selma+, we've chosen a fairer model so clinics can keep more of their revenue.\n\nFor a clinic with monthly revenue of DKK 40,000 and an average treatment price of DKK 500, the difference is already noticeable:",
          cardTitle: "Comparison in practice",
          cardDescription:
            "Calculated with the standard example of a clinic doing DKK 40,000 in monthly revenue.",
          comparison: {
            typicalTitle: "Typical solution",
            typicalFee: "1.9% + DKK 1.50 per payment",
            selmaTitle: "SelmaPay",
            selmaFee: "1.5% + DKK 1.80 per payment",
            savingsTitle: "Savings",
            perYear: "per year",
            noHiddenFees: "No hidden fees. No extra platform fees.",
          },
          calculator: {
            title: "Calculate your savings",
            monthlyRevenue: "Monthly revenue",
            averagePrice: "Average treatment price",
            typicalAnnual: "Typical solution",
            selmaAnnual: "SelmaPay",
            savingsAnnual: "Savings",
          },
          cta: "Keep more of your revenue with SelmaPay",
          methods: ["MobilePay", "Apple Pay", "Visa", "Mastercard"],
        },
        paymentFlow: {
          eyebrow: "Payment flow",
          title: "See how booking and payment land in your clinic",
          description:
            "The patient pays {amount} {currency}. Selma+ takes a transaction fee of {percent}% + {fixedFee} {currency} ({fee} {currency} total), and the rest goes to the clinic.",
          stats: {
            patientPays: "Patient pays {amount} {currency}",
            selmaFee:
              "Selma+ transaction fee ({percent}% + {fixedFee} {currency}): {fee} {currency}",
            clinicReceives: "Clinic receives {net} {currency}",
          },
          labels: {
            scenario: "Scenario",
            patient: "Patient",
            selma: "Selma+",
            clinic: "Clinic",
            fee: "Selma+ transaction fee ({percent}% + {fixedFee} {currency})",
          },
          brandAlt: "Selma+ logo",
          feeBadge: {
            title:
              "Selma+ transaction fee ({percent}% + {fixedFee} {currency}): {fee} {currency}",
            subtitle: "To Selma+",
          },
          patient: {
            title: "Patient",
            tag: "Online booking: your clinic",
            timeLabel: "Time",
            timeValue: "Tuesday at 10:00",
            priceLabel: "Price",
            status: "Booked and sent straight to the calendar",
          },
          clinic: {
            title: "Clinic receives",
            note: "Transferred directly to the clinic",
          },
          flow: {
            bookingLabel: "Booking sent straight into your system",
            paymentLabel: "Payment {amount} {currency}",
          },
          phone: {
            systemLabel: "Booking system",
            systemStatus: "Available",
            calendarTitle: "Open slots",
            slotLabel: "Open slot",
            slotValue: "10:00",
            confirmed: "Booking added to the calendar",
            receiptTitle: "Booking paid",
            totalLabel: "Payment",
            feeLabel: "Selma+ transaction fee ({percent}% + {fixedFee} {currency})",
            feeNote: "To Selma+",
          },
        },
        builder: {
          eyebrow: "Clinic website",
          title: "Your professional clinic page. Ready in minutes.",
          pill: "100% integrated: bookings land directly in your calendar.",
          description:
            "Skip the technical hassle. Selma+ automatically generates a beautiful booking page based on your profile so you can focus on patients.",
          imageAlt: "Website builder preview",
        },
        bookingFlow: {
          eyebrow: "Booking flow",
          title: "Book quickly and confidently",
          viewTag: "Patient view",
          steps: ["Category", "Service", "Time & clinician", "Confirm"],
          weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          categories: [
            {
              id: "physio",
              title: "Physiotherapy",
              description: "Pain relief, mobility, and rehab.",
            },
            {
              id: "chiro",
              title: "Chiropractic",
              description: "Back, neck, and alignment care.",
            },
            {
              id: "osteopathy",
              title: "Osteopathy",
              description: "Holistic treatment approach.",
            },
            {
              id: "sports",
              title: "Sports therapy",
              description: "Injuries and performance.",
            },
            {
              id: "mind",
              title: "Mental support",
              description: "Stress, anxiety, and calm.",
            },
            {
              id: "recovery",
              title: "Recovery",
              description: "Care and restoration.",
            },
          ],
          services: {
            physio: [
              { id: "physio-1", name: "Initial consultation", duration: 45, price: 520 },
              { id: "physio-2", name: "Follow-up treatment", duration: 30, price: 360 },
              { id: "physio-3", name: "Extended session", duration: 60, price: 690 },
            ],
            chiro: [
              { id: "chiro-1", name: "Spine assessment", duration: 40, price: 580 },
              { id: "chiro-2", name: "Adjustment", duration: 25, price: 420 },
              { id: "chiro-3", name: "Combo session", duration: 55, price: 720 },
            ],
            osteopathy: [
              { id: "osteo-1", name: "Full-body treatment", duration: 50, price: 610 },
              { id: "osteo-2", name: "Fascia & mobility", duration: 35, price: 440 },
              { id: "osteo-3", name: "Deep tissue therapy", duration: 60, price: 740 },
            ],
            sports: [
              { id: "sport-1", name: "Injury screening", duration: 30, price: 390 },
              { id: "sport-2", name: "Performance check", duration: 50, price: 610 },
              { id: "sport-3", name: "Return to play", duration: 60, price: 760 },
            ],
            mind: [
              { id: "mind-1", name: "Therapy session", duration: 50, price: 720 },
              { id: "mind-2", name: "Acute stress session", duration: 30, price: 520 },
              { id: "mind-3", name: "Treatment plan", duration: 60, price: 840 },
            ],
            recovery: [
              { id: "recovery-1", name: "Body scan", duration: 35, price: 360 },
              { id: "recovery-2", name: "Recharge", duration: 45, price: 520 },
              { id: "recovery-3", name: "Recovery plus", duration: 60, price: 690 },
            ],
          },
          practitioners: [
            {
              id: "practitioner-1",
              name: "Anna Madsen",
              title: "Senior clinician",
              avatar: getPublicAssetUrl("hero-2/physio-hero-01.jpg"),
            },
            {
              id: "practitioner-2",
              name: "Jonas Kragh",
              title: "Physiotherapist",
              avatar: getPublicAssetUrl("hero-2/physio-hero-02.jpg"),
            },
            {
              id: "practitioner-3",
              name: "Maria Lyng",
              title: "Osteopath",
              avatar: getPublicAssetUrl("hero-2/physio-hero-03.jpg"),
            },
          ],
          step1: {
            title: "Step 1 · Choose treatment type",
            description: "Pick the area that best fits your needs.",
          },
          step2: {
            title: "Step 2 · Choose a specific service",
            description: "See duration and price, then select the best fit.",
          },
          step3: {
            title: "Step 3 · Choose time and clinician",
            description: "Pick a date and see available times with your clinician.",
          },
          calendar: {
            selectDate: "Select date",
          },
          step4: {
            title: "Step 4 · Confirmation",
            description: "Choose how you want to confirm your appointment.",
            summaryTitle: "Your selection",
            summaryService: "Service",
            summaryTime: "Time",
            sms: "SMS code",
            guest: "Continue as guest",
            nameLabel: "Name",
            namePlaceholder: "Your name",
            emailLabel: "Email",
            emailPlaceholder: "you@email.com",
            addressLabel: "Address",
            addressPlaceholder: "Street, postal code, city",
            phoneLabel: "Phone number",
            phonePlaceholder: "+1 555 123 4567",
            payment: {
              title: "Secure payment with Stripe",
              description:
                "Payment is completed at booking so your time is secured. We support MobilePay, Apple Pay, Google Pay, Dankort, Visa, and Mastercard.",
              payCta: "Go to payment",
            },
            smsCta: "Send SMS code",
            smsHint: "We'll send a confirmation message to {phone}.",
            phoneFallback: "your number",
            confirmCta: "Confirm booking",
            confirmHint: "We'll send a confirmation to {email}.",
            emailFallback: "your email",
          },
          actions: {
            select: "Select",
            back: "Back",
            next: "Next step",
          },
        },
        liveBuilder: {
          images: {
            psychGallery1: "Calm therapy room",
            psychGallery2: "Consultation room",
            psychGallery3: "Mental health",
          },
          upload: {
            errors: {
              endpointMissing:
                "Upload endpoint not found. Restart the backend server (npm run server).",
              failedWithStatus: "Upload failed ({status}).",
              missingUrl: "Upload failed: missing photo URL.",
              generic: "Upload failed.",
              network:
                "Could not reach the backend server. Start it with: npm run server",
            },
          },
          generate: {
            error: "Could not generate preview.",
          },
          previewIntro: {
            title: "Try it now: See your future page instantly",
            description:
              "Enter your details below and see how patients will meet you online.",
          },
          eyebrow: "Clinic website",
          titlePrefix: "See your",
          titleHighlight: "future clinic page",
          titleSuffix: "live",
          steps: {
            questions: "3-6 questions",
            preview: "preview",
            previewSuffix: "in a few seconds",
            save: "save",
            saveSuffix: "when you're ready",
          },
          note: {
            primary:
              "Upload your own images. If you don't have them ready, we can generate images for you.",
            secondary:
              "The preview is only a draft. The final clinic website is finished by professional web builders.",
          },
          badges: {
            restored: "Draft restored",
            loginRequired: "Login required to save",
          },
          actions: {
            edit: "Edit",
            savePublish: "Save & publish",
            generateAgain: "Generate again",
            generate: "Generate in 20s",
            generating: "Generating...",
          },
          form: {
            clinicName: "Clinic name",
            clinicNamePlaceholder: "e.g., North Clinic",
            profession: "Profession",
            professionPlaceholder: "e.g., Physiotherapist",
            practitionerName: "Your name",
            practitionerNamePlaceholder: "e.g., Mette Jensen",
            yearsExperience: "Years of experience",
            yearsExperiencePlaceholder: "e.g., 8",
            targetAudience: "Who do you typically help?",
            targetAudiencePlaceholder:
              "e.g., stress, anxiety, pain, sports injuries",
            approach: "Your approach",
            approachPlaceholder:
              "e.g., evidence-based, calm, and precise",
            serviceLabel: "Service {index}",
            servicePlaceholderPrimary: "e.g., Injury treatment",
            servicePlaceholderSecondary: "e.g., Rehab coaching",
            aboutBulletLabel: "About me - bullet {index}",
            aboutBulletPlaceholderPrimary: "e.g., Specializes in ...",
            aboutBulletPlaceholderSecondary: "e.g., Focus on ...",
            city: "City",
            cityPlaceholder: "e.g., Aarhus",
            tone: "Tone",
            toneOptions: {
              professionalCalm: "professional/calm",
              warmEmpathetic: "warm/empathetic",
              energeticMotivating: "energetic/motivating",
              expertClinical: "expert/clinical",
            },
            languages: "Languages",
            languagesPlaceholder: "e.g., Danish, English",
            aboutPhoto: "About me - photo",
            photoAlt: "Photo of you",
            photoUrlPlaceholder: "/uploads/... or https://...",
            photoUploading: "Uploading photo...",
          },
          footerNote: "We keep a draft locally. Saving requires login.",
        },
        preview: {
          draft: {
            title: "Clinic website draft",
            description:
              "If you have your own images, you can add them directly. If not, Selma+ can generate them for you.",
            note: "The final result is produced by professional web builders.",
          },
          chat: {
            headerLabel: "Live chat",
            headerTitle: "Selma+ Reception",
            welcome: "Welcome to {clinicName}, how can I help?",
            clinicFallback: "your clinic",
            roles: {
              user: "Patient",
              assistant: "Reception",
            },
            inputPlaceholder: "Type a message...",
            send: "Send",
            errorFallback: "Something went wrong. Please try again.",
          },
          empty: {
            title: "Preview",
            heading: "Your clinic page will appear here",
            description: "Fill in the fields and click “Generate in 20s”.",
          },
          hero: {
            headline: "Advanced healthcare for your whole family",
            supportingText:
              "Experience compassionate, personalized care with a clinic that puts your needs first.",
            ctaPrimary: "Book appointment",
            ctaSecondary: "Call us now",
            imageAlt: "Modern clinic facility",
            secondaryImageAlt: "Clinic treatment",
            badge: "Now accepting new patients",
            availabilityLabel: "Available",
          },
          heroStats: [
            { value: "15+", label: "Years experience" },
            { value: "2k+", label: "Happy patients" },
            { value: "4.9", label: "Patient rating" },
          ],
          navLinks: ["About", "Treatments", "The clinic"],
          templateLabel: "Template",
          about: {
            eyebrow: "About",
            photoAlt: "Portrait",
            photoAltNamed: "Portrait of {name}",
            bulletsTitle: "About",
            credentialsTitle: "Education & certifications",
          },
          gallery: {
            title: "The clinic",
            imageAlt: "Image",
          },
          sections: {
            services: "Services",
            serviceFallback: "Service",
            trust: "Trust",
            contact: "Contact",
            contactAddress: "Address",
            contactPhone: "Phone",
            contactEmail: "Email",
            booking: "Booking",
          },
        },
      },
      workflow: {
        eyebrow: "Features",
        title: "Transcription and dictation - how you use it in the journal",
        description:
          "We show the exact workflow you meet in the journal, adapted for the website so it's easy to understand.",
        ariaLabel: "Selma+ journal features",
        tabTag: "Journal",
        tabs: [
          {
            id: "transcription",
            label: "Transcription",
            title: "Live transcription inside the journal",
            description:
              "Selma+ listens and writes the conversation as you treat. You get a clean transcript without extra clicks.",
            bullets: [
              "Speaker separation and clear markers",
              "Latest sentences ready for review",
              "Built for clinical notes and calm sessions",
            ],
          },
          {
            id: "facts",
            label: "Dictation",
            title: "Dictate clinical notes directly into the journal",
            description:
              "Record your note as a clinician - quickly, accurately, and in language suited for clinical documentation. Perfect after the consult when you want your assessment, conclusion, and plan captured without typing everything manually.",
            bullets: [
              "Built for clinical assessments - Phrase conclusions, plans, and HEP the way you would write them.",
              "Journal-ready text with minimal edits - Automatic punctuation and readable structure so you can review and save fast.",
              "Structured output in templates - Choose a template, dictate, and get a finished note with clear headings.",
            ],
          },
        ],
        badge: {
          facts: "Dictation in the journal",
          transcription: "Live transcription",
        },
        panel: {
          titleFacts: "Dictation",
          titleTranscription: "Live transcript",
          subtitleFacts: "Powered by Corti",
          subtitleTranscription: "Secure audio recording",
          liveBadge: "Live",
          record: "Record",
          recordingStatus: "Recording in the background",
        },
        sample: {
          whisperText:
            "Clinician: How has the shoulder been since last time?\n\nPatient: It's better, but still tight when lifting.\n\nClinician: We'll test ROM and adjust the exercises.\n\nPatient: That sounds good.",
          facts: [
            { id: "f-1", text: "Pain in right shoulder when lifting", groupKey: "anamnesis" },
            { id: "f-2", text: "Onset 3 weeks ago after gardening", groupKey: "anamnesis" },
            { id: "f-3", text: "Reduced ROM in abduction", groupKey: "objective" },
            { id: "f-4", text: "Tenderness around the deltoid", groupKey: "objective" },
            { id: "f-5", text: "Exercise program twice weekly", groupKey: "plan" },
            { id: "f-6", text: "Follow-up in 2 weeks", groupKey: "plan" },
          ],
          transcripts: [
            { id: "t-1", transcript: "The patient reports pain when lifting.", final: true },
            { id: "t-2", transcript: "Testing ROM and planning exercises.", final: true },
            { id: "t-3", transcript: "Follow-up in two weeks.", final: false },
          ],
        },
        factsPanel: {
          title: "FactsR",
          poweredBy: "Powered by Corti",
          groupFallback: "Other",
          status: {
            connecting: "Connecting...",
            streaming: "Live",
            finalizing: "Finalizing...",
            ended: "Ended",
            error: "Error",
            idle: "Ready",
          },
          record: {
            start: "Record",
            stop: "Stop recording",
          },
          interaction: "Interaction:",
          latest: "Latest",
          insertBarLabel: "Insert into journal",
          insertBarTitle: "Insert into journal:",
          insertTargets: {
            auto: "Auto",
            anamnesis: "History",
            conclusionFocus: "Focus areas",
            conclusionContent: "Session content",
            conclusionTasks: "Tasks",
            conclusionReflection: "Reflection",
            combined: "Combined",
          },
          insertSelected: "Insert into journal",
          insertSelectedTitle: "Insert selected facts",
          insertAll: "Insert all",
          insertAllTitle: "Insert all facts into selected field",
          tabs: {
            facts: "Facts",
            transcript: "Transcript",
          },
          actions: {
            flush: "Flush",
            clear: "Clear",
          },
          item: {
            select: "Select",
            recommended: "Recommended",
            insert: "Insert",
            insertTitle: "Insert this statement into the selected field",
          },
          empty: {
            facts:
              "No facts yet. The first facts typically arrive after ~60 seconds. Use them as suggestions and always review clinically.",
            transcript: "No transcript yet.",
          },
          meta: {
            source: "source",
            discarded: "discarded",
          },
          groups: {
            anamnesis: "History",
            objective: "Findings",
            plan: "Plan",
          },
        },
        whisper: {
          ariaLabel: "Whisper transcription",
          title: "Whisper transcription",
          subtitle: "Latest data from transcription",
          excerptTitle: "Text excerpt",
          placeholder: "No text available.",
          usageTitle: "Token usage",
          usageType: "Clinical",
          usageLabels: {
            type: "Type",
            input: "Input",
            output: "Output",
            total: "Total",
            textTokens: "Text tokens",
            audioTokens: "Audio tokens",
          },
        },
      },
    },
    login: {
      title: "Login / Sign up",
      description:
        "Log in or create an account with email and password. You can also continue with Google.",
      form: {
        emailLabel: "Email",
        emailPlaceholder: "Enter your email",
        passwordLabel: "Password",
        passwordPlaceholder: "Enter your password",
        confirmPasswordLabel: "Confirm password",
        confirmPasswordPlaceholder: "Enter your password again",
        methodLabel: "Login method",
        methodEmail: "Email",
        methodPhone: "Phone",
        methodEmployee: "Employee",
        phoneLabel: "Phone number",
        phonePlaceholder: "+45 12 34 56 78",
        phoneHelper: "You'll receive an SMS code. Standard rates may apply.",
        usernameLabel: "Username",
        usernamePlaceholder: "Enter your username",
        employeeHelper:
          "Choose Employee and sign in with the username your clinic created for you.",
        sendCode: "Send code",
        smsCodeLabel: "Verification code",
        smsCodePlaceholder: "6 digits",
        confirmCode: "Verify & sign in",
        remember: "Keep me signed in",
        resetPassword: "Reset password",
        signIn: "Sign in",
        orContinue: "Or continue with",
        google: "Continue with Google",
        loginLink: "Login",
        signUpLink: "Sign up",
      },
      testimonials: {
        avatarAlt: "Avatar",
      },
      status: {
        loggedIn: "You're now signed in. Preparing your account...",
        signingIn: "Signing in...",
        codeSent: "Code sent. Check your SMS.",
        resetSent: "Password reset email sent. Check your inbox.",
      },
      errors: {
        google: "Google sign-in failed.",
        emailConfirmationRequired:
          "Email confirmation is required to finish signing in.",
        emailLinkFailed: "Unable to finish sign in.",
        emailPasswordRequired: "Enter both email and password.",
        wrongPassword: "Incorrect password. Try again.",
        weakPassword: "Password is too weak. Use at least 6 characters.",
        invalidEmail: "Invalid email. Check the spelling and try again.",
        emailInUse: "Email already exists. Try signing in with your password.",
        authFailed: "Could not sign in or create account.",
        phoneMissing: "Enter your phone number.",
        phoneInvalid: "Invalid phone number. Use the +45 12345678 format.",
        tooManyRequests: "Too many attempts. Try again later.",
        recaptchaFailed: "reCAPTCHA failed. Try again.",
        recaptchaInit: "Unable to start reCAPTCHA. Try again.",
        phoneSendFailed: "Could not send SMS code.",
        codeMissing: "Enter the verification code.",
        codeInvalid: "Incorrect verification code.",
        codeExpired: "The code has expired. Send a new code.",
        phoneLoginFailed: "Could not sign in with phone.",
        employeeUsernameRequired: "Enter your username.",
        employeeLoginFailed: "Could not sign in as employee.",
        signupFieldsRequired: "Enter email, password, and confirm password.",
        passwordMismatch: "Passwords do not match.",
        providerMismatch:
          "This account exists with a different sign-in method. Use the original method.",
        emailPasswordFirst: "Enter email and password first.",
        userNotFound: "Email not found. Click 'Create account' to sign up.",
        loginFailed: "Could not sign in.",
        signupFailed: "Could not create or sign in.",
        resetMissingEmail: "Enter your email first, then choose Reset password.",
        resetFailed: "Could not send reset email.",
      },
      prompt: {
        confirmEmail: "Please confirm your email to sign in",
      },
      aria: {
        backHome: "Back to home",
      },
    },
  },
};
