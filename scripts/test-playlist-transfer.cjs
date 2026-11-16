// Перенос плейлистов: разбор форматов других сервисов и выбор правильной версии трека.
const assert = require('node:assert/strict');
const T = require('../app/playlist-transfer.js');

// Exportify (Spotify): миллисекунды, соисполнители через запятую, кавычки в названии.
const csv = [
  '"Track URI","Track Name","Artist URI(s)","Artist Name(s)","Album Name","Track Duration (ms)"',
  '"spotify:track:1","Get Lucky (feat. Pharrell Williams)","x","Daft Punk,Pharrell Williams","Random Access Memories","369626"',
  '"spotify:track:2","Кино","y","Macan","Кино","165000"',
  '"spotify:track:3","Say ""Hello""","z","Someone","A","200000"',
].join('\n');
let r = T.parse(csv, 'Мой плейлист.csv');
assert.equal(r.name, 'Мой плейлист');
assert.equal(r.items.length, 3);
assert.deepEqual(r.items[0], {
  title: 'Get Lucky (feat. Pharrell Williams)',
  artist: 'Daft Punk',
  album: 'Random Access Memories',
  duration: 370,
});
assert.equal(r.items[2].title, 'Say "Hello"');

// Копия страницы плейлиста Яндекс Музыки: номер, название, исполнители, длительность.
r = T.parse('1\nКино\nMacan\n2:45\n2\nБенз\nMacan, Artik\n3:01\n3\nE\nShazam\nMacan\n2:58\n');
assert.deepEqual(
  r.items.map((x) => [x.artist, x.title, x.duration]),
  [
    ['Macan', 'Кино', 165],
    ['Macan', 'Бенз', 181],
    ['Macan', 'Shazam', 178],
  ]
);

// M3U и простой список с номерами и длительностями.
r = T.parse(
  '#EXTM3U\n#EXTINF:215,Daft Punk - Get Lucky\nC:\\Music\\a.mp3\n/home/u/Music/Kino - Gruppa krovi.mp3\n'
);
assert.deepEqual(
  r.items.map((x) => [x.artist, x.title, x.duration]),
  [
    ['Daft Punk', 'Get Lucky', 215],
    ['Kino', 'Gruppa krovi', null],
  ]
);
r = T.parse('01. Daft Punk — Get Lucky 6:09\n2) Кино – Группа крови\nGet Lucky by Daft Punk\n');
assert.deepEqual(
  r.items.map((x) => [x.artist, x.title, x.duration]),
  [
    ['Daft Punk', 'Get Lucky', null],
    ['Кино', 'Группа крови', null],
  ]
);

// Ссылки без названий — подсказка, а не мусорный список.
assert.equal(
  T.parse('https://open.spotify.com/track/abc\nhttps://open.spotify.com/track/def').hint,
  'spotify-links'
);

// Подбор: оригинал выше каверов и ускоренных версий; «Artist - Title» в названии загрузки;
// русские и латинские написания; обратный порядок в списке.
const item = { artist: 'Daft Punk', title: 'Get Lucky', duration: 369 };
const ranked = T.rank(item, [
  { title: 'Get Lucky (sped up)', artist: 'Daft Punk', duration: 290 },
  {
    title: 'Daft Punk - Get Lucky (feat. Pharrell Williams)',
    artist: 'random uploader',
    duration: 368,
  },
  { title: 'Get Lucky cover', artist: 'Some Band', duration: 250 },
]);
assert.equal(ranked[0].track.artist, 'random uploader');
assert.equal(T.verdict(ranked[0]), 'sure');
assert.ok(
  T.score({ artist: 'Макан', title: 'Кино' }, { artist: 'Macan', title: 'Кино' }) >= T.SURE
);
assert.ok(
  T.score({ artist: 'Кино', title: 'Macan' }, { artist: 'Macan', title: 'Кино' }) >= T.MAYBE
);
assert.equal(
  T.verdict(
    T.rank({ artist: 'Nobody', title: 'Unknown song' }, [{ title: 'Other', artist: 'X' }])[0]
  ),
  'missing'
);
// Ремиксы, мэшапы и «волны» не принимаются за оригинал, даже если название внутри.
const best = (item, list) => T.rank(item, list)[0]?.track.title;
assert.equal(
  best({ artist: 'Daft Punk', title: 'Get Lucky' }, [
    { title: 'Daft Punk - Get Lucky (Fabian Special Disco Mix)', artist: 'Daft Punk' },
    { title: 'Get Lucky', artist: 'Daft Punk' },
  ]),
  'Get Lucky'
);
assert.equal(
  best({ artist: 'The Weeknd', title: 'Blinding Lights' }, [
    { title: 'BLINDING LIGHTS x FLASHING LIGHTS', artist: 'The Weeknd, Kanye West' },
    { title: 'Blinding Lights', artist: 'The Weeknd' },
  ]),
  'Blinding Lights'
);
assert.notEqual(
  T.verdict(
    T.rank({ artist: 'Кино', title: 'Последний герой' }, [
      { title: 'Последний Герой (Doomer Wave)', artist: 'Кино' },
    ])[0]
  ),
  'sure'
);
console.log('Playlist transfer parsing and matching passed');
