/**
 * Bibliothèque d'illustrations : planches à l'encre façon vieux grimoire.
 *
 * Toutes sont des SVG originaux, écrits à la main pour ce projet, sans image externe ni tracé repris
 * d'une œuvre ou d'un artiste. L'aspect « fait main » vient de techniques génériques :
 *  - un filtre qui fait légèrement trembler le trait (#hand),
 *  - un double trait décalé, comme un dessin repris à la plume,
 *  - des hachures (#hatch) pour les ombres,
 *  - de légers lavis de couleur (ocre, rouge, vert-de-gris) posés sous le trait.
 * Les couleurs viennent des classes CSS de src/style.css : une seule palette pour toute l'ambiance.
 * Une scène y fait référence par son identifiant : `"illustration": "torch"` dans le JSON.
 *
 * Notes TypeScript (voir aussi GUIDE-TYPESCRIPT.md) :
 *  - `(x: number, y: number) => string` : une fonction dont on annonce les types d'arguments et de retour ;
 *  - `c: "wo" | "wr" | "wg" | "wt" = "wo"` : paramètre limité à ces valeurs, avec une valeur par défaut ;
 *  - `Record<string, string>` : un dictionnaire identifiant → texte SVG ;
 *  - les gabarits `\`...${...}...\`` (template literals) assemblent le SVG comme en JS classique.
 */

// ---------- Petits outils de dessin ----------
const R = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}h${-w}z`;
const C = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
/** Trait d'encre, doublé d'un second trait fin et décalé. */
const k = (d: string) => `<path class="ik" d="${d}"/><path class="ik2" d="${d}" transform="translate(1.4 -1.2)"/>`;
/** Lavis de couleur (wo ocre, wr rouge, wg vert, wt vert-de-gris). */
const w = (d: string, c: "wo" | "wr" | "wg" | "wt" = "wo") => `<path class="${c}" d="${d}"/>`;
/** Hachures d'ombre. */
const h = (d: string) => `<path class="hh" fill="url(#hatch)" d="${d}"/>`;
/** Aplat d'encre noire. */
const b = (d: string) => `<path class="bk" d="${d}"/>`;
/** Aplat clair (papier, os, yeux) et or. */
const sd = (d: string) => `<path class="sd" d="${d}"/>`;
const gd = (d: string) => `<path class="gd" d="${d}"/>`;
/** Griffonnage de texte : n petites vagues. */
const scr = (x: number, y: number, n: number) => `M${x} ${y}q4-5 8 0${"t8 0".repeat(n)}`;
/** Lueur vacillante. */
const fl = (s: string) => `<g class="flicker">${s}</g>`;
/** Sol : trait irrégulier et petites hachures. */
const ground = (y = 128) =>
  k(`M14 ${y}q70-5 150 0t142-2`) +
  `<path class="ik2" d="${Array.from({ length: 12 }, (_, i) => `M${28 + i * 24} ${y + 6}l7 7`).join("")}"/>`;

const DEFS =
  `<defs>` +
  `<filter id="hand" x="-4%" y="-4%" width="108%" height="108%">` +
  `<feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="4" result="n"/>` +
  `<feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G"/>` +
  `</filter>` +
  `<pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">` +
  `<line x1="0" y1="0" x2="0" y2="5" class="ik" style="stroke-width:1.1"/></pattern>` +
  `</defs>`;

/** Cadre de planche : double filet et petits losanges aux angles. */
const frame =
  k(R(8, 8, 304, 144)) +
  `<path class="ik2" d="${R(12, 12, 296, 136)}"/>` +
  [[8, 8], [312, 8], [8, 152], [312, 152]].map(([x, y]) => `<path class="bk" d="M${x} ${y - 4}l4 4-4 4-4-4z"/>`).join("");

const svg = (body: string) =>
  `<svg viewBox="0 0 320 160" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">` +
  `${DEFS}<g filter="url(#hand)">${frame}${body}</g></svg>`;

const star = (x: number, y: number) => k(`M${x} ${y}l2 6 6 2-6 2-2 6-2-6-6-2 6-2z`);

// ---------- Cabinets de serveurs (aventure des Bugs) ----------
const cabinet = (x: number, lights: [string, string, string, string]) =>
  w(R(x, 22, 64, 98)) + h(`M${x + 40} 22h24v98h-24z`) + k(R(x, 22, 64, 98)) +
  [0, 1, 2, 3]
    .map(
      (r) =>
        k(R(x + 6, 30 + r * 22, 52, 16)) +
        `<path class="${lights[r]}" d="${C(x + 50, 38 + r * 22, 3)}"/>` +
        `<path class="ik" d="${C(x + 18, 38 + r * 22, 2)}"/>`,
    )
    .join("");

// ---------- Grille du captcha ----------
const captchaGrid = [0, 1, 2]
  .flatMap((r) =>
    [0, 1, 2].map((c) => {
      const x = 105 + c * 38;
      const y = 29 + r * 30;
      const chosen = (r * 3 + c) % 4 === 1;
      return (
        (chosen ? w(R(x, y, 34, 26), "wt") : "") +
        k(R(x, y, 34, 26)) +
        (chosen ? k(`M${x + 8} ${y + 14}l6 6 12-13`) : "")
      );
    }),
  )
  .join("");

export const illustrations: Record<string, string> = {
  "crypt-entrance": svg(
    w(C(262, 38, 13)) + k(C(262, 38, 13)) +
    w("M64 128V62L160 26 256 62V128z") + h("M208 59L256 62V128H208z") +
    k("M64 128V62L160 26 256 62V128") + k("M64 62H256") +
    b("M132 128V86a28 28 0 0 1 56 0V128z") +
    fl(w("M148 128V96a12 12 0 0 1 24 0V128z", "wr")) +
    k("M132 128V86a28 28 0 0 1 56 0V128") +
    k("M160 26V10M153 16H167") +
    k("M36 128q5-28-1-52M35 96l-16-14M37 106l15-14M35 80l-8-12M36 84l9-10") +
    k("M280 128V110a8 8 0 0 1 16 0V128") +
    ground(),
  ),

  hall: svg(
    w(R(48, 40, 24, 88)) + h("M62 40h10v88H62z") + k(R(48, 40, 24, 88)) +
    w(R(248, 40, 24, 88)) + h("M262 40h10v88H262z") + k(R(248, 40, 24, 88)) +
    k("M40 44Q160-8 280 44") + k("M72 44Q160 4 248 44") +
    b("M132 128V80a28 28 0 0 1 56 0V128z") + k("M132 128V80a28 28 0 0 1 56 0V128") +
    k("M16 140L100 128M304 140L220 128M160 128V144M130 128L110 144M190 128L210 144") +
    k("M96 92h12M102 92V74") +
    fl(w("M102 74c-11-11-5-24 0-32 5 8 11 21 0 32z", "wr")) +
    k("M102 74c-11-11-5-24 0-32 5 8 11 21 0 32z"),
  ),

  torch: svg(
    `<path class="ik2" d="M104 40l-12-6M214 40l12-6M96 80h-16M224 80h16M120 24l-6-8M206 22l6-8"/>` +
    w("M146 142L154 72L170 74L164 142Z") + h("M146 142L154 72L160 73L156 142Z") +
    k("M146 142L154 72L170 74L164 142Z") + k("M152 90H168M151 104H167") +
    fl(w("M162 66c-26-14-22-34-6-50 2 14 20 20 18 34 10-6 12-18 8-26 18 16 14 40-20 42z", "wr")) +
    k("M162 66c-26-14-22-34-6-50 2 14 20 20 18 34 10-6 12-18 8-26 18 16 14 40-20 42z") +
    k("M162 62c-10-8-8-18 0-26 6 8 10 18 0 26z"),
  ),

  "secret-passage": svg(
    w(R(24, 20, 272, 108)) +
    k("M24 48H296M24 76H296M24 104H296") +
    k("M90 20V48M170 20V48M250 20V48M56 48V76M130 48V76M210 48V76M270 48V76M90 76V104M170 76V104M250 76V104M56 104V128M130 104V128M210 104V128") +
    b(R(138, 52, 44, 32)) + k(R(138, 52, 44, 32)) +
    `<path class="kl" d="${C(152, 68, 6)}M158 68H172M168 68V75M173 68V73"/>` +
    w(R(196, 106, 36, 22)) + h("M218 106h14v22h-14z") + k(R(196, 106, 36, 22)) +
    w("M24 128q10-10 22 0z", "wg") + w("M270 128q10-12 26 0z", "wg"),
  ),

  corridor: svg(
    w("M16 16L120 52V108L16 144z") + h("M16 16L120 52V108L16 144z") +
    w("M304 16L200 52V108L304 144z") + w("M16 144L120 108H200L304 144z") +
    k("M16 16L120 52M304 16L200 52M16 144L120 108M304 144L200 108") + k(R(120, 52, 80, 56)) +
    b("M134 108V84a26 26 0 0 1 52 0V108z") + fl(w("M148 108V92a12 12 0 0 1 24 0V108z", "wr")) +
    k("M70 126H250M96 116H224M160 108V144") +
    k("M64 62h10M69 62V50") + fl(w("M69 50c-6-6-3-13 0-18 3 5 6 12 0 18z", "wr")),
  ),

  chest: svg(
    `<path class="ik2" d="M160 20V38M120 34l10 12M200 34l-10 12M96 56l14 6M224 56l-14 6"/>` +
    w(R(100, 88, 120, 42)) + h("M180 88h40v42h-40z") + k(R(100, 88, 120, 42)) +
    w("M100 88a60 38 0 0 1 120 0z") + k("M100 88a60 38 0 0 1 120 0z") +
    k("M126 58V130M194 58V130") +
    gd(R(150, 92, 20, 24)) + k(R(150, 92, 20, 24)) + k(C(160, 102, 2)) +
    w(R(76, 130, 168, 14)) + h("M76 130h168v14H76z") + k(R(76, 130, 168, 14)) +
    star(240, 50) + star(84, 70),
  ),

  guardian: svg(
    w(R(126, 26, 68, 32)) + k(R(126, 26, 68, 32)) +
    w(R(100, 62, 120, 52)) + h("M170 62h50v52h-50z") + k(R(100, 62, 120, 52)) +
    w(R(74, 64, 24, 62)) + k(R(74, 64, 24, 62)) +
    w(R(222, 64, 24, 62)) + h("M234 64h12v62h-12z") + k(R(222, 64, 24, 62)) +
    w(R(116, 114, 34, 16)) + k(R(116, 114, 34, 16)) +
    w(R(170, 114, 34, 16)) + k(R(170, 114, 34, 16)) +
    fl(w(R(138, 38, 14, 6), "wr") + w(R(168, 38, 14, 6), "wr")) +
    k(R(138, 38, 14, 6)) + k(R(168, 38, 14, 6)) + k("M146 50H174") +
    k("M132 80l10 8-8 8 12 8M200 70l-8 10 8 6") +
    w("M100 114q8-8 20 0z", "wg") +
    ground(),
  ),

  victory: svg(
    `<path class="ik2" d="M160 22V8M112 36L102 26M208 36L218 26M84 70H66M236 70H254"/>` +
    w("M100 120l-8-56 36 28 32-44 32 44 36-28-8 56z") + h("M160 48L192 92 228 64 220 120H160z") +
    k("M100 120l-8-56 36 28 32-44 32 44 36-28-8 56z") +
    w(R(100, 120, 120, 14)) + k(R(100, 120, 120, 14)) +
    w(C(130, 127, 4), "wr") + w(C(160, 127, 4), "wr") + w(C(190, 127, 4), "wr") +
    k(C(92, 62, 4)) + k(C(160, 46, 4)) + k(C(228, 62, 4)) +
    star(52, 40) + star(262, 36),
  ),

  escape: svg(
    w("M56 130V72a104 62 0 0 1 208 0V130H228V80a68 44 0 0 0 -136 0V130z") +
    w("M92 130V80a68 44 0 0 1 136 0V130z") +
    `<path class="ik2" d="M160 90L130 42M160 90L190 42M160 90L104 70M160 90L216 70"/>` +
    k("M56 130V72a104 62 0 0 1 208 0V130") + k("M92 130V80a68 44 0 0 1 136 0V130") +
    k(C(160, 88, 7)) + k("M160 96V116M160 102L146 110M160 102L174 94M160 116L148 130M160 116L174 130") +
    ground(),
  ),

  skull: svg(
    `<path class="bn" d="M86 136L234 70"/><path class="bn2" d="M86 136L234 70"/>` +
    `<path class="bn" d="M86 70L234 136"/><path class="bn2" d="M86 70L234 136"/>` +
    sd("M160 24c-38 0-60 24-60 52 0 18 8 28 18 36v18h84v-18c10-8 18-18 18-36 0-28-22-52-60-52z") +
    h("M188 40c16 10 26 38 14 66v24h-20z") +
    k("M160 24c-38 0-60 24-60 52 0 18 8 28 18 36v18h84v-18c10-8 18-18 18-36 0-28-22-52-60-52z") +
    b(C(136, 78, 13)) + b(C(184, 78, 13)) + b("M160 94l-8 16h16z") +
    k("M139 112v18M160 112v18M181 112v18"),
  ),

  sewer: svg(
    w("M36 130V64a124 56 0 0 1 248 0V130z") +
    b("M76 130V72a84 40 0 0 1 168 0V130z") +
    k("M36 130V64a124 56 0 0 1 248 0V130") + k("M76 130V72a84 40 0 0 1 168 0V130") +
    k("M44 80l16 4M52 54l14 10M80 34l8 12M240 34l-8 12M268 54l-14 10M276 80l-16 4") +
    w("M76 120q14-8 28 0t28 0 28 0 28 0 28 0 28 0V130H76z", "wt") +
    k("M76 120q14-8 28 0t28 0 28 0 28 0 28 0 28 0") + k("M120 126q10-4 20 0M180 124q10-4 20 0") +
    k("M160 54q-4 8 0 12q4-4 0-12z"),
  ),

  captcha: svg(
    w(R(76, 16, 168, 112)) + k(R(76, 16, 168, 112)) +
    sd(R(98, 26, 124, 92)) + k(R(98, 26, 124, 92)) +
    captchaGrid +
    k(C(84, 24, 2)) + k(C(236, 24, 2)) + k(C(84, 120, 2)) + k(C(236, 120, 2)) +
    ground(),
  ),

  alarm: svg(
    w("M126 112C126 80 134 62 160 56C186 62 194 80 194 112z") + h("M160 56C186 62 194 80 194 112H170z") +
    k("M126 112C126 80 134 62 160 56C186 62 194 80 194 112z") +
    w(R(118, 112, 84, 6)) + k(R(118, 112, 84, 6)) +
    w(C(160, 127, 8)) + k(C(160, 127, 8)) +
    k("M160 56V48") + k(C(160, 42, 6)) +
    fl(w("M104 70q-14 22 0 46M216 70q14 22 0 46", "wr")) +
    k("M104 70q-14 22 0 46M88 62q-22 30 0 62M216 70q14 22 0 46M232 62q22 30 0 62"),
  ),

  scroll: svg(
    w(R(84, 28, 152, 96)) + k(R(84, 28, 152, 96)) +
    w(C(132, 108, 11)) + k(C(132, 108, 11)) +
    w("M70 32a10 10 0 0 1 20 0V120a10 10 0 0 1-20 0z") + k("M70 32a10 10 0 0 1 20 0V120a10 10 0 0 1-20 0z") +
    w("M230 32a10 10 0 0 1 20 0V120a10 10 0 0 1-20 0z") + k("M230 32a10 10 0 0 1 20 0V120a10 10 0 0 1-20 0z") +
    [52, 66, 80, 94]
      .map((y, i) => `<path class="ik" style="stroke-width:1.4" d="${scr(104, y, [10, 10, 7, 4][i])}"/>`)
      .join("") +
    w(C(206, 106, 12), "wr") + k(C(206, 106, 12)) + k("M200 106l4 4 8-9") +
    w("M262 56q22-20 36-30q-2 22-20 40z") + k("M262 56q22-20 36-30q-2 22-20 40z") + k("M262 56L250 70"),
  ),

  terminal: svg(
    w(R(44, 20, 232, 106)) + b(R(48, 38, 224, 84)) + k(R(44, 20, 232, 106)) + k("M44 34H276") +
    k(C(56, 27, 3)) + k(C(68, 27, 3)) + k(C(80, 27, 3)) +
    [52, 65, 78, 91]
      .map((y, i) => `<path class="gl${i === 2 ? " err" : ""}" d="${scr(60, y, [14, 9, 16, 6][i])}"/>`)
      .join("") +
    fl(gd(R(60, 104, 10, 12))),
  ),

  servers: svg(
    cabinet(40, ["lg", "lg", "ly", "lg"]) +
    cabinet(128, ["lg", "lr", "lg", "lg"]) +
    cabinet(216, ["ly", "lg", "lg", "lg"]) +
    `<path class="lr" d="${C(160, 136, 8)}"/>` + k(C(160, 136, 8)),
  ),

  "ghost-bug": svg(
    w("M120 120V70c0-28 18-44 40-44s40 16 40 44v50l-13-10-13 10-14-10-14 10-13-10z", "wt") +
    h("M182 34c12 8 18 22 18 36v50l-13-10-13 10z") +
    k("M120 120V70c0-28 18-44 40-44s40 16 40 44v50l-13-10-13 10-14-10-14 10-13-10z") +
    sd(C(146, 68, 7)) + sd(C(174, 68, 7)) + k(C(146, 68, 7)) + k(C(174, 68, 7)) +
    b(C(146, 70, 3)) + b(C(174, 70, 3)) + k("M148 88q12 8 24 0") +
    k("M148 30q-10-14-22-14M172 30q10-14 22-14") + b(C(126, 16, 3)) + b(C(194, 16, 3)) +
    k("M122 94l-16 10M122 82l-18-6M198 94l16 10M198 82l18-6"),
  ),

  hotfix: svg(
    w(R(110, 20, 100, 108)) + h("M170 20h40v108h-40z") + k(R(110, 20, 100, 108)) +
    k(R(120, 32, 80, 16)) + k(R(120, 56, 80, 16)) + k(R(120, 80, 80, 16)) +
    `<path class="lr" d="${C(190, 40, 3)}"/>` +
    `<g transform="rotate(-20 160 96)">` +
    sd(R(92, 84, 136, 28)) + k(R(92, 84, 136, 28)) + w(R(142, 84, 36, 28)) + k(R(142, 84, 36, 28)) +
    k(`${C(108, 98, 1.5)}${C(120, 98, 1.5)}${C(200, 98, 1.5)}${C(212, 98, 1.5)}`) +
    `</g>` +
    fl(w("M240 128c-16-14-6-28 0-40 6 12 16 26 0 40z", "wr")) + k("M240 128c-16-14-6-28 0-40 6 12 16 26 0 40z") +
    `<path class="ik2" d="M232 78l-6-8M250 84l8-6M222 96l-8-2"/>`,
  ),
};

export const illustrationIds = Object.keys(illustrations);
