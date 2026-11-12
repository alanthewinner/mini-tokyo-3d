// Station details for the PIDS that are not available as open data, transcribed
// from the in-car LCD of a Tokyo Metro 1000 series train on the Ginza Line
// (Shibuya-bound, as of September 2016).
//
// door: which side the doors open on, relative to the display
// gates: ticket gates on the platform diagram. x is where the stairs meet the
//     platform, from 0 (rear end of the train) to 1 (front end) when running
//     towards Shibuya. Values outside [0, 1] are beyond the platform ends.
// elevators: elevator positions on the same scale
// via: a passage shown above the platform, such as "Thru Tozai Line Tracks"
// across: a line served across the platform
// note: 'step' (watch your step) or 'gap' (wide gap between train and platform)

export const PIDS_AS_OF = {ja: '2016年9月現在', en: 'as of September 2016'};

export const PIDS_CAR_NUMBER = 3;
export const PIDS_CAR_COUNT = 6;

export const PIDS_STATIONS = {
    'TokyoMetro.Ginza.Tawaramachi': {
        door: 'this',
        gates: [
            {ja: '改札', en: 'Gate', exits: '1~3', x: 0.37},
            {ja: 'エレベーター専用改札', en: 'Elevator Gate', exits: '', x: 0.97}
        ]
    },
    'TokyoMetro.Ginza.Inaricho': {
        door: 'this',
        gates: [
            {ja: '改札', en: 'Gate', exits: '1・2', x: 0.42}
        ]
    },
    'TokyoMetro.Ginza.Ueno': {
        door: 'this',
        gates: [
            {ja: 'JR上野駅方面改札', en: 'JR Ueno Sta. District Gate', exits: '1・2・9', x: 0.16},
            {ja: '上野公園方面改札', en: 'Ueno Park District Gate', exits: '3~8', x: 0.75}
        ],
        elevators: [-0.06]
    },
    'TokyoMetro.Ginza.UenoHirokoji': {
        door: 'this',
        gates: [
            {ja: '改札', en: 'Gate', exits: 'A3・A4', x: 0.5},
            {ja: '改札', en: 'Gate', exits: 'A1・A2・A5~A8', x: 0.75}
        ],
        note: 'gap'
    },
    'TokyoMetro.Ginza.Suehirocho': {
        door: 'this',
        gates: [
            {ja: '改札', en: 'Gate', exits: '1・2', x: 0.64}
        ]
    },
    'TokyoMetro.Ginza.Kanda': {
        door: 'opposite',
        gates: [
            {ja: '須田町改札', en: 'Sudacho Gate', exits: '5・6', x: 0},
            {ja: '内神田方面改札', en: 'Uchi-kanda Gate', exits: '1~4', x: 1}
        ]
    },
    'TokyoMetro.Ginza.Mitsukoshimae': {
        door: 'opposite',
        gates: [
            {ja: '室町三丁目方面改札', en: 'Muromachi 3 chome Gate', exits: 'A10', x: 0},
            {ja: '中央改札', en: 'Central Gate', exits: 'A7~A9', x: 0.6},
            {ja: '三越方面改札', en: 'Mitsukoshi District Gate', exits: 'A1~A6・B4~B6', x: 1}
        ],
        elevators: [0.08],
        note: 'step'
    },
    'TokyoMetro.Ginza.Nihombashi': {
        door: 'this',
        gates: [
            {ja: '日本橋交差点改札', en: 'Nihombashi Crossing Gate', exits: 'B5~B12・A1・A3~A6・C1~C6・D1~D4', x: 0.05},
            {ja: '高島屋方面改札', en: 'Takashimaya District Gate', exits: 'B0~B4', x: 0.97}
        ],
        via: {ja: '東西線ホーム経由', en: 'Thru Tozai Line Tracks'},
        note: 'step'
    },
    'TokyoMetro.Ginza.Kyobashi': {
        door: 'opposite',
        gates: [
            {ja: '明治屋方面改札', en: 'Meijiya District Gate', exits: '6・7', x: 0},
            {ja: '銀座方面改札', en: 'Ginza Gate', exits: '1~5', x: 1}
        ],
        note: 'step'
    },
    'TokyoMetro.Ginza.Ginza': {
        door: 'opposite',
        gates: [
            {ja: '松屋方面改札', en: 'Matsuya District Gate', exits: 'A11~A13', x: 0},
            {ja: '銀座四丁目交差点方面改札', en: 'Ginza 4 chome Crossing Gate', exits: 'A1~A10・B1~B10・C1~C9', x: 0.66}
        ],
        elevators: [0.12],
        note: 'gap'
    },
    'TokyoMetro.Ginza.Shimbashi': {
        door: 'opposite',
        gates: [
            {ja: '新橋交差点方面改札', en: 'Shimbashi Crossing Gate', exits: '1~3', x: 0.08},
            {ja: 'JR新橋駅方面改札', en: 'JR Shimbashi Sta. District Gate', exits: '4~6', x: 0.46},
            {ja: '西新橋方面改札', en: 'Nishi Shimbashi Gate', exits: '7・8', x: 0.95}
        ],
        elevators: [0.2]
    },
    'TokyoMetro.Ginza.Toranomon': {
        door: 'this',
        gates: [
            {ja: '西新橋方面改札', en: 'Nishi-shimbashi Gate', exits: '9・10', x: 0},
            {ja: '西新橋方面改札', en: 'Nishi-shimbashi Gate', exits: '1', x: 0.19},
            {ja: '虎ノ門交差点方面改札', en: 'Toranomon Crossing Gate', exits: '2・8・11', x: 1}
        ],
        note: 'step'
    },
    'TokyoMetro.Ginza.TameikeSanno': {
        door: 'opposite',
        gates: [
            {ja: '溜池交差点方面改札', en: 'Tameike Crossing Gate', exits: '9~13', x: 0.25},
            {ja: '永田町方面改札', en: 'Nagatacho Gate', exits: '5・6', x: 0.7},
            {ja: '赤坂方面改札', en: 'Akasaka Gate', exits: '7・8', x: 1}
        ],
        elevators: [0],
        via: {ja: '南北線ホーム経由', en: 'Thru Namboku Line Tracks'}
    },
    'TokyoMetro.Ginza.AkasakaMitsuke': {
        door: 'opposite',
        gates: [
            {ja: '山王下方面改札', en: 'Sanno-shita District Gate', exits: '11', x: 0},
            {ja: '赤坂見附方面改札', en: 'Akasaka-mitsuke District Gate', exits: '10・A~D', x: 1}
        ],
        elevators: [0.3, 0.98],
        via: {ja: '半蔵門線ホーム経由', en: 'Thru Hanzomon Line Tracks'},
        across: {ja: '丸ノ内線 新宿・荻窪方面', en: 'Marunouchi Line for Shinjuku, Ogikubo'},
        note: 'gap'
    },
    'TokyoMetro.Ginza.AoyamaItchome': {
        door: 'this',
        gates: [
            {ja: '南青山方面改札', en: 'Minami-aoyama Gate', exits: '3~5', x: 0.6},
            {ja: '北青山方面改札', en: 'Kita-aoyama Gate', exits: '0~2', x: 0.88}
        ]
    },
    'TokyoMetro.Ginza.Gaiemmae': {
        door: 'this',
        gates: [
            {ja: '外苑いちょう並木方面改札', en: 'Gaien Icho-namiki District Gate', exits: '4a・4b', x: 0},
            {ja: '神宮球場方面改札', en: 'Jingu Baseball Stadium District Gate', exits: '1~3', x: 0.9}
        ],
        note: 'step'
    },
    'TokyoMetro.Ginza.OmoteSando': {
        door: 'this',
        gates: [
            {ja: '表参道交差点改札', en: 'Omote-sando Crossing Gate', exits: 'A1~A3・B4・B5', x: 0.2},
            {ja: '青山通り方面改札', en: 'Aoyama-dori Ave. Gate', exits: 'A4・A5・B1~B3', x: 0.45},
            {ja: '青山学院方面改札', en: 'Aoyamagakuin District Gate', exits: 'B1~B4', x: 0.97}
        ],
        elevators: [0.48],
        across: {ja: '半蔵門線 長津田・中央林間方面 東急田園都市線直通', en: 'Hanzomon Line for Nagatsuta, Chuo-rinkan Thru to Tokyu Den-en-toshi Line'}
    },
    'TokyoMetro.Ginza.Shibuya': {
        door: 'this',
        gates: [
            {ja: '宮益坂方面改札', en: 'Miyamasuzaka District Gate', exits: '', x: 0.42},
            {ja: 'ハチ公前交差点改札', en: 'Hachiko Crossing Gate', exits: '', x: 0.58},
            {ja: '東急百貨店方面改札', en: 'Tokyu Dept. District Gate', exits: '', x: 0.81}
        ],
        note: 'gap'
    }
};

// Sections where the "mind the train sway" warning is shown, in either direction
export const PIDS_CURVES = [
    ['TokyoMetro.Ginza.Asakusa', 'TokyoMetro.Ginza.Tawaramachi'],
    ['TokyoMetro.Ginza.Kanda', 'TokyoMetro.Ginza.Mitsukoshimae'],
    ['TokyoMetro.Ginza.Toranomon', 'TokyoMetro.Ginza.TameikeSanno']
];

// The direction the diagrams above were drawn for
export const PIDS_REFERENCE_TERMINAL = {
    'TokyoMetro.Ginza': 'TokyoMetro.Ginza.Shibuya'
};

export const PIDS_NOTES = {
    step: {ja: '足元にご注意ください。', en: 'Please watch your step.'},
    gap: {ja: '足元にご注意ください。電車とホームの間が広く開いています。', en: 'Please mind the wide gap between the train and the platform.'}
};

// Official line symbols used for the transfer icons. Tokyo Metro and Toei
// lines use a ring with a letter, other operators a rounded square.
export const PIDS_LINE_MARKS = {
    'TokyoMetro.Ginza': 'G',
    'TokyoMetro.Marunouchi': 'M',
    'TokyoMetro.MarunouchiBranch': 'M',
    'TokyoMetro.Hibiya': 'H',
    'TokyoMetro.Tozai': 'T',
    'TokyoMetro.Chiyoda': 'C',
    'TokyoMetro.Yurakucho': 'Y',
    'TokyoMetro.Hanzomon': 'Z',
    'TokyoMetro.Namboku': 'N',
    'TokyoMetro.Fukutoshin': 'F',
    'Toei.Asakusa': 'A',
    'Toei.Mita': 'I',
    'Toei.Shinjuku': 'S',
    'Toei.Oedo': 'E',
    'JR-East.Yamanote': 'JY',
    'JR-East.KeihinTohokuNegishi': 'JK',
    'JR-East.ChuoRapid': 'JC',
    'JR-East.ChuoSobuLocal': 'JB',
    'JR-East.SaikyoKawagoe': 'JA',
    'JR-East.ShonanShinjuku': 'JS',
    'JR-East.Utsunomiya': 'JU',
    'JR-East.Takasaki': 'JU',
    'JR-East.Tokaido': 'JT',
    'JR-East.SobuRapid': 'JO',
    'JR-East.Yokosuka': 'JO',
    'JR-East.JobanRapid': 'JJ',
    'JR-East.JobanLocal': 'JL',
    'JR-East.Keiyo': 'JE',
    'JR-East.Musashino': 'JM',
    'JR-East.Nambu': 'JN',
    'JR-East.Yokohama': 'JH',
    'Tokyu.Toyoko': 'TY',
    'Tokyu.DenEnToshi': 'DT',
    'Tokyu.Meguro': 'MG',
    'Tokyu.Oimachi': 'OM',
    'Tokyu.Ikegami': 'IK',
    'Tokyu.TokyuTamagawa': 'TM',
    'Tokyu.Setagaya': 'SG',
    'Keio.Keio': 'KO',
    'Keio.KeioNew': 'KO',
    'Keio.Inokashira': 'IN',
    'Odakyu.Odawara': 'OH',
    'Odakyu.Tama': 'OT',
    'Odakyu.Enoshima': 'OE',
    'Seibu.Ikebukuro': 'SI',
    'Seibu.SeibuYurakucho': 'SI',
    'Seibu.Shinjuku': 'SS',
    'Tobu.TobuSkytree': 'TS',
    'Tobu.TobuSkytreeBranch': 'TS',
    'Tobu.Isesaki': 'TI',
    'Tobu.Tojo': 'TJ',
    'Tobu.TobuUrbanPark': 'TD',
    'Keisei.Main': 'KS',
    'Keisei.Oshiage': 'KS',
    'Keisei.NaritaSkyAccess': 'KS',
    'Keisei.Kanamachi': 'KS',
    'Keikyu.Main': 'KK',
    'Keikyu.Airport': 'KK',
    'Sotetsu.Main': 'SO',
    'Sotetsu.SotetsuShinYokohama': 'SO',
    'Yurikamome.Yurikamome': 'U',
    'TWR.Rinkai': 'R',
    'MIR.TsukubaExpress': 'TX',
    'TokyoMonorail.HanedaAirport': 'MO',
    'Toei.NipporiToneri': 'NT',
    'Toei.Arakawa': 'SA',
    'SaitamaRailway.SaitamaRailway': 'SR',
    'Minatomirai.Minatomirai': 'MM',
    'Hokuso.Hokuso': 'HS',
    'ToyoRapid.ToyoRapid': 'TR'
};
