window.SoundSyncPetArt = function (pet) {
  if (!pet.species)
    return '<svg viewBox="0 0 280 250" aria-hidden="true"><defs><linearGradient id="egg" x2=".8" y2="1"><stop stop-color="#fff5c7"/><stop offset="1" stop-color="#d8bd75"/></linearGradient></defs><ellipse cx="140" cy="224" rx="49" ry="10" fill="#302a3866"/><path d="M140 30c-34 0-78 76-78 125 0 47 30 67 78 67s78-20 78-67c0-49-44-125-78-125z" fill="url(#egg)" stroke="#423747" stroke-width="5"/><ellipse cx="115" cy="85" rx="14" ry="26" transform="rotate(25 115 85)" fill="#fff" opacity=".35"/><path d="m76 150 20-14 20 22 24-17 23 19 24-24 20 11" fill="none" stroke="#ac8a4a" stroke-width="5"/><g fill="#ad8b4c" opacity=".4"><ellipse cx="143" cy="80" rx="8" ry="11"/><ellipse cx="173" cy="115" rx="6" ry="9"/><ellipse cx="115" cy="188" rx="9" ry="7"/><circle cx="165" cy="188" r="6"/></g></svg>';

  const sprite = animal(pet);
  if (sprite) return sprite;
  const color =
    pet.species === 'fox'
      ? '#f4a35b'
      : pet.species === 'dog'
        ? '#d4b088'
        : pet.species === 'cat'
          ? '#c6bfd8'
          : { calm: '#ffe15b', energy: '#ff9972', dream: '#b59bff' }[pet.mood] || '#ffe15b';
  const ears =
    pet.species === 'dog'
      ? '<path d="M79 99Q35 70 46 141q15 25 33-8M200 99q44-29 33 42-15 25-33-8" fill="#996443" stroke="#24202a" stroke-width="5"/>'
      : pet.species === 'cat' || pet.species === 'fox'
        ? '<path d="M70 110 72 44 119 83M163 83l46-39 2 66" fill="' +
          color +
          '" stroke="#24202a" stroke-width="5"/><path d="m80 85 1-23 20 19m80 0 18-19 2 23" fill="#edacac"/>'
        : pet.level >= 2
          ? '<path d="M76 101Q46 29 83 44L116 85M166 85L198 44Q231 28 204 102" fill="' +
            color +
            '" stroke="#24202a" stroke-width="5"/>'
          : '';
  const accessory =
    pet.accessory === 'headphones'
      ? '<path d="M61 137C42 39 236 39 219 137" fill="none" stroke="#36313f" stroke-width="13"/><rect x="44" y="119" width="27" height="51" rx="13" fill="#36313f"/><rect x="209" y="119" width="27" height="51" rx="13" fill="#36313f"/><path d="M53 128v30M227 128v30" stroke="' +
        color +
        '" stroke-width="4"/>'
      : pet.accessory === 'star'
        ? '<path d="m141 39 7 14 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2z" fill="#fff7cc" stroke="#493c4b" stroke-width="3"/>'
        : pet.accessory === 'crown'
          ? '<path d="m106 71-8-39 27 18 16-29 17 29 25-18-8 39z" fill="#ffd849" stroke="#4f3732" stroke-width="4"/>'
          : '';
  return (
    '<svg viewBox="0 0 280 250" aria-hidden="true">' +
    ears +
    '<ellipse cx="107" cy="215" rx="24" ry="12" fill="#35303e"/><ellipse cx="176" cy="215" rx="24" ry="12" fill="#35303e"/><path d="M62 163C49 109 75 71 140 71s91 38 78 92c-8 35-26 52-78 52s-70-17-78-52" fill="' +
    color +
    '" stroke="#24202a" stroke-width="5"/><ellipse cx="112" cy="95" rx="26" ry="9" fill="#fff" opacity=".3"/><g class="pet-eyes"><ellipse cx="109" cy="139" rx="8" ry="12" fill="#25202e"/><ellipse cx="173" cy="139" rx="8" ry="12" fill="#25202e"/><circle cx="111" cy="135" r="2.5" fill="white"/><circle cx="175" cy="135" r="2.5" fill="white"/></g><ellipse cx="89" cy="158" rx="13" ry="7" fill="#ef796f" opacity=".5"/><ellipse cx="193" cy="158" rx="13" ry="7" fill="#ef796f" opacity=".5"/><path d="M128 163q13 16 26 0" fill="none" stroke="#25202e" stroke-width="5" stroke-linecap="round"/>' +
    accessory +
    (pet.level >= 4
      ? '<g fill="#fff5c3"><path d="m33 91 4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/><path d="m244 170 4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/></g>'
      : '') +
    '</svg>'
  );
};

const petFrames = {
  cat: {
    sleep: 'assets/pets/cat/sleep.png',
    sit: 'assets/pets/cat/sit.png',
    nod: 'assets/pets/cat/nod.png',
  },
  dog: {
    sleep: 'assets/pets/dog/sleep.png',
    sit: 'assets/pets/dog/sit.png',
    nod: 'assets/pets/dog/nod.png',
  },
  fox: {
    sleep: 'assets/pets/fox/sleep.png',
    sit: 'assets/pets/fox/sit.png',
    nod: 'assets/pets/fox/nod.png',
  },
  bear: {
    sleep: 'assets/pets/bear/sleep.png',
    sit: 'assets/pets/bear/sit.png',
    nod: 'assets/pets/bear/nod.png',
  },
  wolf: {
    sleep: 'assets/pets/wolf/sleep.png',
    sit: 'assets/pets/wolf/sit.png',
    nod: 'assets/pets/wolf/nod.png',
  },
};

let petSpriteId = 0;
function animal(pet) {
  const frames = petFrames[pet.species];
  if (!frames) return '';
  const image = (pose, name = '') =>
    '<image class="' +
    name +
    '" width="330" height="230" filter="url(#' +
    prefix +
    'alpha)" clip-path="url(#' +
    prefix +
    'silhouette-' +
    pose +
    ')" href="' +
    frames[pose] +
    '"/>';
  const fitting = {
    cat: { sit: [145, 85, 54, 157], sleep: [129, 111, 52, 174] },
    dog: { sit: [149, 87, 56, 157], sleep: [124, 112, 54, 173] },
    fox: { sit: [146, 85, 59, 158], sleep: [127, 116, 55, 178] },
    bear: { sit: [158, 87, 61, 159], sleep: [130, 124, 54, 183] },
    wolf: { sit: [148, 86, 57, 157], sleep: [129, 110, 54, 175] },
  }[pet.species];
  function accessory(pose) {
    const [x, base, half, neck] = fitting[pose];
    const origin = 'translate(' + x + ' ' + base + ')' + (pose === 'sleep' ? ' rotate(-8)' : '');
    const group = (content) =>
      '<g class="pet-accessory pet-accessory-' +
      pet.accessory +
      '" data-anchor-x="' +
      x +
      '" data-anchor-y="' +
      base +
      '" transform="' +
      origin +
      '">' +
      content +
      '</g>';
    if (pet.accessory === 'crown')
      return group(
        '<path d="M-22 0V-6H-24V-22H-18V-18H-12V-14H-8V-18H-4V-25H4V-18H8V-14H12V-18H18V-22H24V-6H22V0Z" fill="#f2c65d" stroke="#655035" stroke-width="3" stroke-linejoin="miter"/><path d="M-19-5H19" stroke="#fff0a3" stroke-width="3"/>'
      );
    if (pet.accessory === 'headphones')
      return group(
        '<path d="M-' +
          half +
          ' 39V8Q-' +
          half +
          '-8 0-8T' +
          half +
          ' 8V39" fill="none" stroke="#403e4d" stroke-width="7"/><path d="M-' +
          half +
          ' 37V9Q-' +
          half +
          '-5 0-5T' +
          half +
          ' 9V37" fill="none" stroke="#827c98" stroke-width="2"/><rect x="' +
          (-half - 6) +
          '" y="18" width="13" height="29" rx="3" fill="#484252" stroke="#26242e" stroke-width="3"/><rect x="' +
          (half - 7) +
          '" y="18" width="13" height="29" rx="3" fill="#484252" stroke="#26242e" stroke-width="3"/>'
      );
    if (pet.accessory === 'star') {
      const cx = pose === 'sleep' ? x + 40 : x,
        cy = pose === 'sleep' ? neck + 12 : neck;
      return (
        '<g class="pet-accessory pet-accessory-star" data-anchor-x="' +
        cx +
        '" data-anchor-y="' +
        cy +
        '" transform="translate(' +
        cx +
        ' ' +
        cy +
        ')"><path d="M-21-3H21" stroke="#746e79" stroke-width="3"/><path d="M0-4 3 2 10 3 5 8 6 15 0 11-6 15-5 8-10 3-3 2Z" fill="#ffd96c" stroke="#71552d" stroke-width="2"/></g>'
      );
    }
    return '';
  }
  const headGear = pet.accessory === 'star' ? '' : accessory('sit');
  const bodyGear = pet.accessory === 'star' ? accessory('sit') : '';
  const prefix = 'pet-clip-' + ++petSpriteId + '-';
  // Generated sprites contain faint matte pixels outside their hard pixel outline.
  const alpha =
    '<filter id="' +
    prefix +
    'alpha" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncA type="discrete" tableValues="' +
    [...Array(31).fill(0), 1].join(' ') +
    '"/></feComponentTransfer></filter>';
  const silhouette = ['sit', 'sleep']
    .map(
      (pose) =>
        '<clipPath id="' +
        prefix +
        'silhouette-' +
        pose +
        '" clipPathUnits="userSpaceOnUse"><path d="' +
        window.SoundSyncPetSilhouettes[pet.species][pose] +
        '" shape-rendering="crispEdges"/></clipPath>'
    )
    .join('');
  const clips = [];
  const cut = (x, y, width, height) => {
    const id = prefix + clips.length;
    // A one-pixel overlap keeps neighbouring opaque parts seamless at fractional DPI scales.
    clips.push(
      '<clipPath id="' +
        id +
        '" clipPathUnits="userSpaceOnUse"><rect x="' +
        (x - 1) +
        '" y="' +
        (y - 1) +
        '" width="' +
        (width + 2) +
        '" height="' +
        (height + 2) +
        '" shape-rendering="crispEdges"/></clipPath>'
    );
    return '<g clip-path="url(#' + id + ')">' + image('sit') + '</g>';
  };

  const [pawLeft, pawLeftEnd, pawRightStart, pawRight] = {
    cat: [125, 148, 153, 176],
    dog: [122, 146, 153, 177],
    fox: [123, 147, 154, 178],
    bear: [132, 155, 163, 186],
    wolf: [122, 146, 153, 178],
  }[pet.species];
  const pawTop = 170,
    elbow = 188,
    tailStart = 208;
  const body =
    cut(0, 146, tailStart, pawTop - 146) +
    cut(0, pawTop, pawLeft, 230 - pawTop) +
    cut(pawLeftEnd, pawTop, pawRightStart - pawLeftEnd, 230 - pawTop) +
    cut(pawRight, pawTop, tailStart - pawRight, 230 - pawTop);
  const eyes = {
    cat: [121, 109, 159, 109, 10, 17, '#fcf3ea'],
    dog: [124, 103, 164, 103, 10, 16, '#f4b471'],
    fox: [120, 105, 162, 105, 10, 17, '#fd9658'],
    bear: [131, 111, 176, 111, 10, 17, '#b47c61'],
    wolf: [121, 111, 163, 111, 11, 16, '#d0c4bb'],
  }[pet.species];
  const [lx, ly, rx, ry, ew, eh, fur] = eyes;
  const lid = (x, y) =>
    '<g><rect x="' +
    x +
    '" y="' +
    y +
    '" width="' +
    ew +
    '" height="' +
    eh +
    '" fill="' +
    fur +
    '"/><path d="M' +
    x +
    ' ' +
    (y + eh - 4) +
    'h' +
    ew +
    '" stroke="#28262c" stroke-width="4"/></g>';
  const eyelidClip =
    '<clipPath id="' +
    prefix +
    'lids" clipPathUnits="objectBoundingBox"><rect class="pet-lid-reveal" width="1" height="0"/></clipPath>';
  const lids =
    '<g class="pet-lids" clip-path="url(#' +
    prefix +
    'lids)">' +
    lid(lx, ly) +
    lid(rx, ry) +
    '</g>';
  const ears =
    '<g class="pet-ear pet-ear-left">' +
    cut(0, 0, 146, 82) +
    '</g><g class="pet-ear pet-ear-right">' +
    cut(146, 0, 184, 82) +
    '</g>';
  const cheek =
    pet.species === 'wolf'
      ? '<path class="pet-cheek-contour" d="M87 118H94V121H92V127H95V131H89V128H85V122H87Z" fill="#08080a" shape-rendering="crispEdges"/>'
      : '';
  const head =
    '<g class="pet-head-rest"><g class="pet-head-motion">' +
    cut(0, 82, 330, 64) +
    ears +
    cheek +
    lids +
    '<ellipse class="pet-mouth" cx="' +
    (lx + rx + ew) / 2 +
    '" cy="140" rx="7" ry="9" fill="#29262b"/>' +
    headGear +
    '</g></g>';
  const [scratchX, scratchY] = [(pawRightStart + pawRight) / 2, 181];
  const limbColor = {
    cat: '#fcf3ea',
    dog: '#f4b471',
    fox: '#fd9658',
    bear: '#b47c61',
    wolf: '#d0c4bb',
  }[pet.species];
  const scratch =
    '<g class="pet-scratch-arm" transform="translate(' +
    scratchX +
    ' 0)"><path d="M-9 ' +
    scratchY +
    'H9L20 167 28 145V137H16L14 149 8 160-4 171Z" fill="' +
    limbColor +
    '" stroke="#28262c" stroke-width="3" stroke-linejoin="bevel"/><g class="pet-scratch-paw" transform-origin="22px 146px"><path d="M15 146V132H18V128H25V131H29V146Z" fill="' +
    limbColor +
    '" stroke="#28262c" stroke-width="3" stroke-linejoin="bevel"/></g></g>';
  const seated =
    '<g class="pet-tail">' +
    cut(tailStart, 146, 330 - tailStart, 84) +
    '</g><g class="pet-body">' +
    body +
    bodyGear +
    '</g>' +
    head +
    '<g class="pet-upper-legs">' +
    cut(pawLeft, pawTop, pawLeftEnd - pawLeft, elbow - pawTop) +
    cut(pawRightStart, pawTop, pawRight - pawRightStart, elbow - pawTop) +
    '</g>' +
    '<g class="pet-paw pet-paw-left" transform-origin="' +
    (pawLeft + pawLeftEnd) / 2 +
    'px ' +
    elbow +
    'px" data-joint-left="' +
    pawLeft +
    '" data-joint-right="' +
    pawLeftEnd +
    '" data-joint-y="' +
    elbow +
    '">' +
    cut(pawLeft, elbow, pawLeftEnd - pawLeft, 230 - elbow) +
    '</g>' +
    '<g class="pet-paw pet-paw-right" transform-origin="' +
    (pawRightStart + pawRight) / 2 +
    'px ' +
    elbow +
    'px" data-joint-left="' +
    pawRightStart +
    '" data-joint-right="' +
    pawRight +
    '" data-joint-y="' +
    elbow +
    '">' +
    cut(pawRightStart, elbow, pawRight - pawRightStart, 230 - elbow) +
    '</g>' +
    scratch;
  const effects =
    '<g class="pet-effects">' +
    [0, 1, 2]
      .map(
        (n) =>
          '<g transform="translate(' +
          (112 + n * 38) +
          ' 76)"><path class="pet-effect pet-heart" d="M0 3C-7-4-14 5 0 14C14 5 7-4 0 3Z" fill="#ff9fb8"/></g>'
      )
      .join('') +
    [0, 1, 2]
      .map(
        (n) =>
          '<text class="pet-effect pet-music-note" x="' +
          (108 + n * 40) +
          '" y="70" fill="#ffd629" font-size="24">♪</text>'
      )
      .join('') +
    [0, 1, 2]
      .map(
        (n) =>
          '<rect class="pet-effect pet-dust" x="' +
          (113 + n * 30) +
          '" y="218" width="5" height="4" fill="#d4c4a3"/>'
      )
      .join('') +
    '</g>';
  return (
    '<svg class="animal-pixel pet-raster" viewBox="0 0 330 230" aria-hidden="true"><defs>' +
    alpha +
    silhouette +
    eyelidClip +
    clips.join('') +
    '<radialGradient id="' +
    prefix +
    'love"><stop stop-color="#ff9fb8" stop-opacity=".24"/><stop offset="1" stop-color="#ff9fb8" stop-opacity="0"/></radialGradient></defs><ellipse class="pet-favorite-glow" cx="165" cy="139" rx="106" ry="104" fill="url(#' +
    prefix +
    'love)"/><ellipse class="pet-ground-shadow" cx="165" cy="222" rx="40" ry="5" fill="#000" opacity=".14"/><g class="pet-character"><g class="pet-turn"><g class="pose-curl">' +
    image('sleep') +
    accessory('sleep') +
    '</g><g class="pose-sit">' +
    seated +
    '</g></g></g>' +
    effects +
    '</svg>'
  );
}
