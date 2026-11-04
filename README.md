# MEO GIS Portaal

Overzichtelijk portaal voor MEO Economische Controle. Toont alle informatie uit het
**MEO Centraal Dashboard** (inspectie-weergave) en het **MEO Beleid Dashboard** op één plek,
live uit ArcGIS Online (`meo.maps.arcgis.com`).

## Starten

```bash
python -m http.server 5173
```

Open daarna http://localhost:5173 en kies **Inloggen met ArcGIS** (live) of **Demo bekijken**.
`http://localhost:5173/?demo` opent direct de demo.

## Wat staat erin

| Onderdeel | Bron in het oude dashboard |
|---|---|
| 7 KPI's (totaal, geïnspecteerd, te inspecteren, overtredingen, zonder vergunning, > 6 mnd, controles) | Indicatoren bovenaan |
| Filters: zone, status, soort zaak, inspecteur, periode + zoeken op bedrijf | "Zoeken en filteren" |
| Kaart met statuskleuren of vergunning, aan/uit per categorie | Kaart + legenda |
| Werkvoorraad: te doen, > 6 maanden, overtredingen | Lijst met standplaatsen |
| Vergunning, afgevoerd na sluitingstijd, zone, soort zaak | Beleid-weergave (grafieken) |
| Overtredingen, ontbrekende vergunningen, inspecteurs, controles per maand | Filters/categorieën van inspecties |
| Register van alle standplaatsen (sorteerbaar) + detailpaneel | Lijst + pop-ups |
| Nieuwe inspectie (Survey123), nieuwe standplaats, originele dashboards | Knoppen in het dashboard |

## Bestanden

- `index.html` — structuur
- `css/portal.css` — ontwerp (licht, accent #FFA500, responsief)
- `assets/meo-logo.jpg` — MEO-logo (linksboven en op het inlogscherm)
- `js/config.js` — lagen, velden, links en uitgesloten inspecties (hier aanpassen)
- `js/app.js` — logica (ArcGIS Maps SDK for JavaScript 4.31)
- `js/demo-data.js` — momentopname van 2 november 2026 (echte namen, status, locaties en inspecties; zonder persoonsgegevens)

## Inloggen

Zonder `oauthAppId` gebruikt het portaal het ArcGIS-inlogvenster (gebruikersnaam + wachtwoord).
Gebruikt MEO SSO of MFA, registreer dan in ArcGIS Online een OAuth 2.0-app
(Content → New item → Developer credentials), voeg `http://localhost:5173` (en later het
productieadres) toe als redirect-URL en zet de Client ID in `js/config.js` → `oauthAppId`.

## Start inspectie (vooraf ingevuld)

"Start inspectie" in het detailpaneel werkt zoals de knop "Inspectie starten" in de pop-up van de
webkaart "MEO Centrale Kaart": eigenaar, bedrijfsnaam, adres, KvK-nummer, telefoon en ID-nummer komen
uit de laag Standplaatsen_Inspecties. Het portaal vult dat aan met de locatie en (waar het register leeg
is) gegevens uit de laatste inspectie van hetzelfde bedrijf. Nieuwe bevindingen blijven leeg.
Deze gegevens gaan via de link mee en staan dus in de browsergeschiedenis. Aanpassen kan in
`js/config.js` → `inspectieFormulier`. De knop "Nieuwe inspectie" bovenaan opent bewust een leeg formulier.

## Aannames

- "Zonder vergunning" = aantal inspecties waarin `bedrijfsvoering_vergunning` is ingevuld (85, gelijk aan het dashboard).
- "Aantal controles" telt alle inspecties (240), net als het Centraal Dashboard.
- "Langer dan 6 maanden" = standplaatsen met `Datum_Inspectie` ouder dan 182 dagen.
- Inspecties worden aan standplaatsen gekoppeld via een naamveld in de inspectielaag (indien aanwezig).
