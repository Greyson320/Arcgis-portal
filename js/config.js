// MEO GIS Portaal — configuratie
// Alle bronnen zijn uitgelezen uit het "MEO Centraal Dashboard" en "MEO Beleid Dashboard" (meo.maps.arcgis.com).
window.MEO_CONFIG = {
  portalUrl: "https://meo.maps.arcgis.com",

  // Optioneel: registreer een app in ArcGIS Online (Content > New item > Developer credentials > OAuth 2.0)
  // en vul hier de Client ID in voor inloggen via de officiële ArcGIS-loginpagina (nodig bij SSO/MFA).
  // Leeg laten = inloggen via het ArcGIS-inlogvenster met gebruikersnaam en wachtwoord.
  oauthAppId: "",

  layers: {
    standplaatsen:
      "https://services5.arcgis.com/gBVezkv5TAJekXAg/arcgis/rest/services/Standplaatsen_Inspecties/FeatureServer/0",
    inspecties:
      "https://services5.arcgis.com/gBVezkv5TAJekXAg/arcgis/rest/services/Economische_Inspecties_View/FeatureServer/0"
  },

  // Velden zoals gebruikt door de bestaande dashboards
  fields: {
    naam: "Naam_zaak",
    status: "Status",
    datum: "Datum_Inspectie",
    zone: "Binnen_Buitenstad",
    soort: "Soort_zaak",
    vergunning: "Vergunning",
    afgevoerd: "Afgevoerd_na_sluitingstijd",
    inspecteur: "gecontroleerd_door",
    overtredingen: "overtredingen",
    zonderVergunning: "bedrijfsvoering_vergunning"
  },

  // "Start inspectie" opent het Survey123-formulier vooraf ingevuld — dezelfde koppeling als de knop
  // "Inspectie starten" in de pop-up van de webkaart "MEO Centrale Kaart".
  // Let op: deze gegevens gaan via de link mee en staan dus ook in de browsergeschiedenis.
  inspectieFormulier: {
    url: "https://survey123.arcgis.com/share/6e7d165d0d224381b703fb43f6b523cd",
    // formulierveld: veld in de laag Standplaatsen_Inspecties
    uitRegister: {
      eigenaar: "Naam_klant",
      naam_bedrijf: "Naam_zaak",
      adres_bedrijf: "Adres_zaak",
      kvk_nummer: "KvK_nummer",
      telefoonnummer: "Telefoon",
      id_nummer: "ID_klant"
    },
    // Aanvullend uit de laatste inspectie van hetzelfde bedrijf (alleen als het register leeg is)
    uitVorigeInspectie: [
      "eigenaar", "adres_bedrijf", "kvk_nummer", "telefoonnummer", "id_nummer", "ondernemingsvorm",
      "hoofdcat", "subcat", "subcat1", "subcat2", "type_bedrijf", "oppervlakte", "aantal_kassa"
    ]
  },

  links: {
    nieuweInspectie: "https://survey123.arcgis.com/share/6e7d165d0d224381b703fb43f6b523cd",
    nieuweStandplaats: "https://arcg.is/1KSHi05",
    dashboardInspectie: "https://meo.maps.arcgis.com/apps/dashboards/d7ae12f0185647d2971d071bc1204295",
    dashboardBeleid: "https://meo.maps.arcgis.com/apps/dashboards/b277ca8ef43d4bf7a32dd92e5ebbbcdd",
    portal: "https://meo.maps.arcgis.com/home/"
  },

  // Basiskaarten: "kaart" zoals het Centraal Dashboard (topografisch), "satelliet" met wegen en namen
  map: { center: [-68.95, 12.18], zoom: 11, basemaps: { kaart: "topo-vector", satelliet: "hybrid" } }
};
