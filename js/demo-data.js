// Momentopname (2 nov 2026) van de lagen Standplaatsen_Inspecties en Economische_Inspecties_View
// (meo.maps.arcgis.com). Alleen bedrijfsgegevens en locaties — persoonsgegevens zoals klantnaam,
// telefoon, ID- en KvK-nummers zijn bewust weggelaten. Log in voor actuele gegevens.
window.MEO_DEMO = (function () {
  const DAY = 86400000;
  const date = (d) => (d ? parseInt(d, 36) * DAY : null);

  const SOORTEN = ["Truk di Pan", "Batido", "Standplaats", "Groenten/vruchten", "Hotdogkar", "Tafel", "Kraam", "Batido en Soep", "Johnnycake", "Vis"];
  const STATUS = { G: "Goedgekeurd", N: "Nog niet geinspecteerd", O: "Overtreding", W: "Waarneming" };
  const AFGEVOERD = ["Ja", "Nee", "Nee (vaste bouw)", "Nee (tafel)", "n.v.t.", "wordt niet vermeld"];

  // naam ~ status ~ soort-index ~ zone (B = Binnenstad, U = Buitenstad) ~ inspectiedatum (dagen, base36)
  // ~ vergunning (J/N) ~ afgevoerd-index ~ lengtegraad ~ breedtegraad
  const STANDS =
    "100% Batidos~N~1~B~~J~0~-68.93107~12.10486|Anthony Hotdog Center~N~4~B~~J~0~-68.93467~12.10556|Baby Food Truck Pinguino de Oro~O~0~U~g09~N~0~-69.03146~12.22424|Baby Monkey Smulkar~G~0~U~g06~J~0~-68.97696~12.14687|Batidos Express~N~1~U~~N~1~-68.91943~12.14964|Batidos Gallop~G~1~U~g07~N~2~-69.07442~12.28806|Batidos I Sopi  Dje~N~7~B~~J~1~-68.90813~12.10883|Batidos Gem~O~1~U~g09~N~1~-68.90987~12.11645|Batidos La Consteña~N~1~U~~N~1~-68.95593~12.15997|Batidos Natural~G~1~U~g09~J~1~-68.96241~12.14831|Batidos Yina~N~1~U~~N~0~-68.95931~12.14105|Bistro Gril el Sabroso~O~0~U~g04~N~0~-68.94814~12.15015|Bon Sabor di Edseline Paula~O~0~U~g02~N~1~-68.83590~12.09105|Broertje Mi SO B.V.~N~0~U~~N~1~-68.84882~12.10687|Borrito Mania~N~0~U~~J~0~-68.95146~12.13686|Comidas Rapidas Donde Jhon~N~0~U~~J~1~-68.95146~12.13677|Westpunt Aqua Rental~O~5~U~foe~J~1~-69.15399~12.36975|Curaçao Playa Kenepa Smoothy~N~1~U~~N~2~-69.15163~12.35100|CvC Streetfood Truck~O~0~" +
    "U~g03~J~1~-68.90340~12.10862|Daddy's Grill~O~0~U~g04~J~2~-68.95165~12.13818|Truck Batido Pal'i Tamarijn y Mas (Ada Truck)~N~1~U~~J~0~-68.95930~12.14115|De Smak Mobile Hut~N~0~U~~N~1~-68.92767~12.15803|Deli Shake~O~1~B~g04~N~0~-68.93681~12.10649|Dushi Wafels~N~6~U~~N~0~-68.90692~12.11233|E' Johnnycake~N~8~U~~J~1~-68.95056~12.13382|E Stoba~G~0~U~g0a~N~0~-68.89246~12.10560|El Canario Leon Burgers & Hotdog~N~4~U~~J~0~-68.90555~12.09898|Elaine's Grill~N~0~U~~J~0~-68.87649~12.12332|Evander Shake~G~1~U~g04~N~0~-68.95175~12.13205|Expresso~N~0~U~~J~1~-68.94735~12.15292|Food Truck El Chef Chavarria ( El Goloso)~N~0~U~~J~0~-68.91850~12.14554|Friday's Baby Truck~G~0~U~g02~N~1~-68.88936~12.10481|Frozen Oasis Coco~O~1~B~g03~J~1~-68.90812~12.10884|Furuku~W~0~U~~J~1~-68.94606~12.15734|Garden Phillippe~G~3~U~g05~N~1~-68.88683~12.15372|Gochy Batidos~G~1~U~g04~N~0~-68.93658~12.15239|Grace to Kitoko Kitchen an Mobile Canteen~N~0~U~~J~2~-68.96447~12.16147|G" +
    "rill For You~O~0~B~g04~N~1~-68.95125~12.13456|Hamburguesa Shon Ki~N~4~B~~N~1~-68.93675~12.11138|Hisa dede mobiel~N~0~U~~J~1~-68.95195~12.13257|Hot Pepper~G~0~U~g03~J~0~-68.90134~12.11776|Ivan Fruta I Berdura~N~3~U~~N~3~-68.86790~12.12287|Souaxlicious~N~0~U~~N~1~-68.96771~12.17078|Johnny King~N~0~U~~J~1~-68.96923~12.16896|Johnny Master~N~0~U~~N~1~-68.87131~12.12208|Johnny Master~N~0~U~~N~1~-68.87218~12.12196|Kanti Awa Food Truck~N~0~U~~J~0~-69.15307~12.34298|Karbon_Yust Grill~N~0~U~~J~1~-68.93742~12.15302|Geen~N~9~U~~N~0~-68.93646~12.15223|Koi Laman Fish Truck~N~0~U~~J~1~-68.87260~12.09200|Koki's Grill B.V. (Koki Riba Bloki)~G~0~U~g07~J~1~-68.89567~12.12171|Koki Riba Bloki St.Maria~N~0~U~~J~0~-68.94585~12.15728|Kosnan Dushi Kenepa~O~5~U~foe~J~4~-69.15196~12.35119|La Doña Express~N~0~U~~J~1~-68.94833~12.14953|Ludi Fruta~W~3~U~~J~1~-68.83680~12.13742|M.O.B Kan West End~N~0~U~~J~0~-68.94492~12.10944|Marciana~N~0~U~~J~0~-68.86718~12.12275|Ma" +
    "yra Natural~N~1~U~~N~1~-68.91705~12.14789|Naoki's Place~O~0~U~g03~N~1~-68.88335~12.12533|Nati Special~N~1~U~~N~1~-68.87833~12.11834|Nena's Corner~N~0~U~~J~1~-68.96022~12.15196|Neni's Flavor~O~0~U~g04~J~1~-68.95113~12.13456|Nixon Soto Express~N~0~U~~J~1~-68.94683~12.15719|No Me Olvides Koffie Truck~N~0~U~~J~1~-68.92932~12.14797|Palu Blanku Grill~N~0~U~~N~1~-68.95167~12.13262|Plantashon Batiste~G~5~U~g06~N~1~-68.95917~12.14091|Raikie's Grill & Salads~G~0~U~g03~J~0~-68.90713~12.10852|Raymond Express~N~0~U~~J~1~-68.95182~12.13189|Roger Express~O~0~U~g09~J~0~-68.92392~12.14462|Rugia's Place~N~0~B~~J~5~-68.94857~12.15845|Sahara Grill~N~0~U~~J~1~-68.86330~12.11683|Salt Bay Street Restaurant~N~0~B~~J~1~-68.90806~12.10884|Shadai Danny Burger~N~0~U~~J~5~-68.92848~12.17091|Soup 4 U~N~2~U~~J~0~-68.96912~12.16894|To Job Big To Job Small~G~6~B~g0a~J~5~-68.93606~12.10667|Tok Tok Grill (Wings + Grilled Foods B.V.)~O~0~U~g02~J~1~-68.88429~12.10425|Truck" +
    " di Batidos Juan Domingo~G~1~U~g06~N~1~-68.96459~12.16132|Truck'I Pan Shelby's~N~0~U~~J~1~-68.95164~12.13799|Truck di Pan Molenplein~O~0~B~g04~N~4~-68.93737~12.10633|Vaca Loka Elite (Elite Grill Food)~N~0~U~~J~1~-68.89156~12.10562|VIP~N~0~U~~J~1~-69.01487~12.20354|What The Fork Food Truck~N~0~B~~J~0~-68.94507~12.11016|Chichi Caribbean Tours, Chichi Jetski~G~2~B~foo~J~0~-68.90943~12.09378|Jen's Taste~N~2~U~~J~0~-68.91768~12.15003|The King Appetite's~N~2~U~~J~0~-68.93761~12.15348|Truck di Pan Mi dushi Anny~N~0~U~~J~1~-68.95116~12.15937|Coffe Bike~G~2~U~fof~J~0~-68.86762~12.07973|Dushi Pan~N~2~U~~J~4~-68.87659~12.12335|Daniels Burger~G~2~U~g02~J~0~-68.88748~12.10372|Meat' Up~N~2~U~~J~0~-68.90895~12.10808|Ai Mi Mama~N~0~U~~J~0~-68.85996~12.11898|Sea Life Souveniers & Watersports Accessories~N~2~U~~J~0~-69.15216~12.34138|Stef Sason Dominicao~N~0~U~~J~0~-68.94617~12.15762|Grill Smaak~N~0~U~~J~0~-68.94588~12.15732|KIPPENGRILL~N~0~U~~J~0~-69.13" +
    "556~12.30596|Pa Q' El Maracucho Goloso Food Truck~G~0~B~g02~J~0~-68.89124~12.10542|The Griller~G~0~B~g03~J~0~-68.90733~12.10856|Flavor Craze~O~2~B~g03~J~4~-68.90682~12.10882|Carlito's Kitchen~O~2~U~g03~J~0~-68.90378~12.10566|D'Caribbean Corner, Irie Sandwich~O~2~U~g09~J~0~-68.91063~12.11691|Melany's Shakes~O~1~U~g04~J~1~-68.94752~12.15212|BLNDZ~O~2~U~g02~N~4~-68.89762~12.12814|Brayen David Perigault~O~2~U~fqm~N~4~-68.89762~12.12792|Morning Vibes B.V.~G~1~U~g05~~0~-68.94927~12.15887|Lissa's Catering~G~2~U~foj~J~0~-69.15462~12.34672|The Fish Shack~G~2~U~foi~J~0~-69.15214~12.34127|Grillin'G~O~0~U~g02~J~1~-68.84903~12.10666|Chez Kalaloo~G~2~U~g04~J~0~-68.95150~12.13687|Sharna Accessories~O~5~U~foe~N~0~-68.96409~12.17462|Flavors by JP~O~2~U~g04~J~4~-68.95195~12.13124|Evergreen~O~2~U~foe~J~0~-69.15384~12.36979|Morning Vibes~G~0~U~g05~N~1~-68.94927~12.15887|K-Rico Steakhouse~G~0~U~g02~N~1~-68.85874~12.10404|Mientjes Place~O~0~U~g02~~-1~-68.869" +
    "18~12.12993|Shoarma Papi (Restaurant Luz De Luna BV)~O~0~U~g02~~4~-68.88850~12.10429|Firerock Caribbean Grill~G~0~U~g02~J~4~-68.88223~12.10475|Karbon Den Pariba B.V~G~0~U~g02~~4~-68.87295~12.10906|West Indies Flavor~O~0~U~g03~N~4~-68.90817~12.09635|Kickens Pan I Mas~G~0~U~g03~~4~-68.90804~12.10853|Catch and Cook~O~0~U~g03~~4~-68.90787~12.10843|Zero Below~O~0~U~g03~N~1~-68.90570~12.09879|Eternal Flavor~G~0~U~g03~J~4~-68.90803~12.10845|Late Night Food Truck~O~0~U~g03~N~1~-68.90963~12.10776|Spanks Banks Shoarma Grill and Kapsalon~G~0~U~g03~~-1~-68.90962~12.10774|Burrito Mania Salina~G~0~U~g03~J~0~-68.90706~12.10838|Carbini Smoothies~O~1~U~g04~J~1~-68.95325~12.13003|Volcano's Express~G~0~U~g04~~-1~-68.95919~12.14162|The Evertsz Food Truck~G~0~U~g04~J~0~-68.94851~12.14759|Aji~G~1~U~g05~J~1~-68.94600~12.14978|Ortiz y Rincon Street Food~G~0~U~g05~~-1~-68.91773~12.14566|Hamburguesa de Antonio~G~4~B~g06~N~1~-68.93782~12.10958|Mas que un antojo~G" +
    "~0~U~g07~J~-1~-69.08730~12.25989|La casa de Bati-2~G~1~U~foh~N~1~-69.15012~12.31855|Tropical Fluffy Delights~G~-1~U~g08~~-1~-69.15164~12.35164|Purba un pida~G~2~U~fok~~-1~-69.08459~12.21219|Al Toque Food Truck~O~0~U~g09~N~1~-68.91244~12.14830";

  // Inspecties: standplaats-index (-1 = geen standplaats) ~ datum ~ inspecteur ~ overtredingen ~ zonder vergunning
  const INSPECTEURS = ["Ingiomar Balentien", "Lysette Mogen", "Franklin Confesor", "", "Christipher Daantje", "F.Confesor"];
  const OVERTREDINGEN = ["geen_overtreding", "prijsaanduiding,netto_eenheid", "anders", "", "bedrijfsvoering", "anders,makutu_basiko", "prijsaanduiding", "openingstijden", "geen_overtreding,anders"];
  const ZONDER = ["", "Horeca_vergunning", "Standplaatsvergunning", "Horeca_vergunning,Standplaatsvergunning", "Vestigingsvergunning,Horeca_vergunning", "Vestigingsvergunning,Standplaatsvergunning,Ventvergunning,Horeca_vergunning", "Vestigingsvergunning,Standplaatsvergunning"];
  const INSPECTIONS =
    "-1~fkf~0~0~0|-1~fkf~1~0~0|-1~fkf~0~0~0|-1~fly~0~0~0|-1~fly~0~1~1|-1~fof~0~2~2|-1~fof~0~2~2|16~fof~0~2~2|110~fof~0~2~1|-1~fof~0~2~2|-1~fof~2~3~0|-1~fof~2~4~2|-1~fog~2~2~2|-1~fog~2~3~0|-1~fog~2~3~0|-1~fog~2~3~0|-1~fog~2~3~2|-1~fog~2~3~0|-1~fog~2~3~2|-1~foh~2~3~0|-1~foh~2~3~1|-1~foh~2~3~0|-1~foh~2~3~1|-1~foi~2~3~1|-1~foi~2~3~1|-1~foi~2~3~0|-1~foj~2~3~2|105~foj~2~3~2|-1~fol~2~5~2|-1~fol~2~3~0|134~fol~2~3~0|-1~foo~2~3~0|-1~fos~2~6~0|-1~fof~0~2~2|-1~fof~0~2~1|-1~fof~0~2~2|-1~fof~0~2~2|-1~fog~0~0~0|-1~fog~0~3~0|-1~fog~0~3~0|-1~fog~0~3~0|-1~fog~0~3~0|-1~fog~0~3~0|-1~fog~0~3~0|-1~fog~0~3~0|-1~foh~0~3~0|-1~foh~0~3~0|-1~foh~0~3~0|-1~foh~0~3~0|-1~foh~0~3~0|-1~foh~0~3~0|-1~foi~0~3~0|-1~foi~0~3~0|-1~foi~0~3~0|132~foi~0~3~2|-1~foi~0~3~0|-1~fok~0~3~0|-1~fok~0~3~0|-1~fok~0~3~0|-1~fok~0~3~0|-1~fol~0~6~2|82~fop~0~3~0|-1~fof~0~2~3|-1~fpi~2~2~1|-1~fpj~2~3~0|-1~fpj~2~3~0|-1~fq3~2~2~2|-1~fq8~2~3~0|40~~3~3~0|-1~fxr~0~0~1|-1~fxr~0~0~0|-1~fy0~0~6~0|-1~fy1~0~6~0|" +
    "-1~fy1~0~0~0|-1~fy6~0~0~0|-1~fy6~0~0~0|-1~fy6~0~0~0|-1~fqn~2~3~4|-1~fqn~2~3~0|129~fzn~2~3~2|-1~fzo~2~7~0|-1~fzy~2~3~1|-1~fzy~2~6~0|-1~fzy~2~3~0|-1~fzy~2~3~1|-1~fzy~2~3~1|-1~fzy~2~3~1|-1~fzy~2~6~4|-1~fzz~2~0~0|-1~fzz~2~2~0|-1~fzz~4~3~0|-1~fzz~4~6~0|-1~fzz~4~3~0|-1~fzz~4~6~0|-1~fzz~4~6~0|-1~g00~2~8~0|-1~g01~2~8~0|-1~g01~2~6~0|-1~g03~2~3~0|12~g03~2~2~2|-1~g03~2~2~2|-1~g03~2~2~2|70~g03~2~2~2|113~g03~2~2~2|101~g03~2~2~2|-1~fqn~2~2~2|-1~g03~2~0~0|-1~g03~2~3~2|-1~g03~2~0~0|-1~g03~2~2~2|-1~g03~2~0~0|-1~g03~2~0~0|-1~g03~2~0~0|-1~g03~2~2~0|-1~g03~2~2~0|-1~g03~2~2~2|-1~g03~2~0~0|-1~g03~2~0~0|-1~g03~2~2~2|-1~g03~2~2~2|117~g04~2~2~0|-1~g04~2~2~2|-1~g04~2~0~0|-1~g04~2~2~2|121~g04~2~3~0|120~g04~2~2~2|-1~g04~2~2~2|121~g04~2~0~0|-1~g04~2~2~2|-1~g04~2~2~2|122~g04~2~2~2|123~g04~2~0~0|-1~g04~2~0~0|96~g04~2~0~0|97~g04~2~2~2|-1~g04~2~0~0|40~g04~2~0~0|-1~g04~2~2~2|-1~g00~1~0~0|-1~g00~1~0~0|-1~g00~1~0~0|-1~g00~1~0~0|-1~g03~1~3~1|-1~g05~5~2~2|22~g05~1~2~2|-1~g0" +
    "5~5~2~1|-1~g05~5~2~2|28~g05~5~0~0|-1~g05~5~2~2|-1~g05~5~2~2|107~g05~5~0~0|-1~g05~5~2~0|-1~g05~5~2~2|-1~g05~5~0~0|-1~g05~5~2~2|-1~g05~5~2~2|-1~g05~5~2~2|-1~g05~5~0~0|-1~g05~5~2~2|-1~g05~5~0~0|-1~g05~5~0~0|-1~g05~5~2~2|128~g06~1~3~0|-1~g06~1~3~0|111~g06~1~3~0|129~g06~1~3~0|-1~g06~1~3~2|85~g06~1~3~0|15~g06~1~3~0|-1~g06~1~3~0|-1~g06~1~3~0|56~g06~1~3~0|-1~g07~1~3~0|65~g07~1~3~0|-1~g07~1~3~0|76~g07~1~3~0|130~g07~1~3~0|-1~g08~1~3~0|5~g08~1~3~0|-1~g08~1~3~0|105~g09~1~3~0|-1~g09~1~3~0|-1~g0a~2~2~2|135~g0a~2~2~2|-1~g0a~2~2~2|-1~g0a~2~2~2|-1~g0a~2~0~0|-1~g0a~2~0~0|2~g0a~2~2~2|-1~g0a~2~0~0|-1~g0a~2~0~0|-1~g0a~2~2~1|-1~g0a~2~0~0|-1~g0a~2~2~1|-1~g0a~2~2~1|-1~g0a~2~0~0|-1~g0a~2~0~0|-1~g0a~2~2~1|-1~g0a~2~0~0|135~g0a~2~2~2|68~g0a~2~2~2|-1~g0b~2~3~5|74~g0b~2~0~2|-1~g0b~2~0~0|-1~g0b~2~0~0|-1~g0b~2~3~6|-1~g0b~2~0~0|-1~g0b~2~3~0|-1~g0b~2~0~0|-1~g0b~2~2~2|-1~g0b~2~0~0|-1~g0b~2~0~0|-1~g0b~2~3~0|-1~g0b~2~3~6|-1~g0b~2~0~0|-1~g0b~2~0~0|-1~g0b~2~3~0|-1~g0b~2~3~0|" +
    "-1~g0b~2~3~0|-1~g0b~2~3~0|-1~g0b~2~0~0|-1~g0b~2~0~0|-1~g0b~2~0~0|-1~g0b~2~0~0|-1~g0b~2~0~0|25~g0b~2~0~0|-1~g0b~2~3~0|-1~g0b~2~3~0|-1~g0b~2~3~0|-1~g0b~2~3~0|-1~g0b~2~3~0|-1~g0b~2~3~0|-1~g0b~2~3~0|-1~g0b~2~3~0|-1~g0c~1~3~0|-1~g0c~1~3~0|-1~g0c~1~3~0|-1~g0d~1~3~0|-1~g0d~1~3~0|111~g0l~2~0~0";

  const stands = STANDS.split("|").map((row, i) => {
    const [naam, st, so, zone, d, verg, afg, lon, lat] = row.split("~");
    return {
      id: i + 1,
      naam: naam.replace(/\s+/g, " ").trim(),
      status: STATUS[st],
      soort: SOORTEN[Number(so)] || null,
      zone: zone === "B" ? "Binnenstad" : zone === "U" ? "Buitenstad" : null,
      datum: date(d),
      vergunning: verg === "J" ? "Ja" : verg === "N" ? "Nee" : null,
      afgevoerd: AFGEVOERD[Number(afg)] || null,
      lon: Number(lon),
      lat: Number(lat)
    };
  });

  const inspections = INSPECTIONS.split("|").map((row, i) => {
    const [idx, d, insp, ov, zv] = row.split("~");
    const stand = stands[Number(idx)];
    return {
      id: i + 1,
      standId: stand ? stand.id : null,
      naam: stand ? stand.naam : null,
      inspecteur: INSPECTEURS[Number(insp)] || "Onbekend",
      overtredingen: OVERTREDINGEN[Number(ov)] || null,
      zonderVergunning: ZONDER[Number(zv)] || null,
      datum: date(d)
    };
  });

  return { stands, inspections, snapshotDate: "2 november 2026" };
})();
