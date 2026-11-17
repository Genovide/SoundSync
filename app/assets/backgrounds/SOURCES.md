# Background scene sources

- Aurora: background #63, attributed by Atuin to Tommy Ho. Adapted shader with reduced terrain and aurora sampling.
  https://atuin.ru/blog/fonovaya-animatsiya-63/
  https://atuin.ru/demo/bg-anim/bg-63.js
- Clouds: background #31, attributed by Atuin to Liam Egan. Adapted to WebGL 2 without the Three.js wrapper; original clouds texture.
  https://atuin.ru/blog/fonovaya-animaciya-31/
  https://atuin.ru/demo/bg-anim/bg-31.js
  https://atuin.ru/demo/bg-anim/clouds.jpg

Application lifecycle, bounded resolution, frame scheduling, palette sampling and shared interface styling are SoundSync integration code.

## Additional scenes

Soft Aurora, Dark Veil, Silk, Galaxy and Light Pillar: David Haz / React Bits.
Original shader passes adapted to a shared WebGL 2 renderer and bounded offscreen targets.
Galaxy has fixed mouse uniforms and no pointer, mouse, touch or click listeners.
https://github.com/DavidHDev/react-bits/tree/main/src/content/Backgrounds
License retained in app/vendor/react-bits-LICENSE.md (MIT + Commons Clause; integrated application use).

Fog: Patricio Gonzalez Vivo / Vanta.js; original noise shader with a shared scheduler.
Globe: tengbao/Vanta.js; original geometry and update code with a shared scheduler and local Three.js r134.
https://github.com/tengbao/vanta
Licenses retained in app/vendor/vanta-LICENSE.md and app/vendor/three-LICENSE.txt.
