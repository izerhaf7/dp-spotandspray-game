// ============================================================
// SPRITES.JS — Procedural pixel art sprite generation
// Renders small canvases → used as cell visuals
// ============================================================

const COLORS = {
  greenLight: '#7BC96F', greenDark: '#4E9B4A', greenDeep: '#3A7A38',
  stressLight: '#C97B5A', stressDark: '#7A5240',
  mustard: '#E8B84B', mustardDark: '#B8922A',
  trunk: '#7A5240', trunkDark: '#5C3D2E', trunkLight: '#9B6B52',
  ground: '#A67C52', groundDark: '#8B6840',
  grey: '#888', greyLight: '#aaa', greyDark: '#666',
  transparent: null,
};

const Sprites = {
  cache: {},

  /**
   * Create a small canvas and draw pixel art onto it.
   * @param {number} w - width in pixels
   * @param {number} h - height in pixels
   * @param {Function} drawFn - receives (ctx, w, h)
   * @returns {HTMLCanvasElement}
   */
  create(w, h, drawFn) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    drawFn(ctx, w, h);
    return c;
  },

  /** Render a pixel map (array of strings) with a palette lookup */
  renderMap(ctx, map, palette, offsetX = 0, offsetY = 0) {
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const ch = map[y][x];
        const col = palette[ch];
        if (col) {
          ctx.fillStyle = col;
          ctx.fillRect(offsetX + x, offsetY + y, 1, 1);
        }
      }
    }
  },

  /** Generate all sprites and cache them */
  init() {
    const palette = {
      '.': null,
      'G': '#7BC96F', 'g': '#4E9B4A', 'd': '#3A7A38',
      'S': '#C97B5A', 's': '#7A5240',
      'Y': '#E8B84B', 'y': '#B8922A',
      'B': '#7A5240', 'b': '#5C3D2E', 'L': '#9B6B52',
      'T': '#A67C52', 't': '#8B6840',
      'X': '#888888', 'x': '#666666', 'z': '#aaaaaa',
    };

    // ---- Healthy Palm Tree (16x20) ----
    const treeHealthy = [
      '....dGG.GGd.....',
      '...dGGGGGGGd....',
      '..gGGGGGGGGGg...',
      '.dG.gGGGGGg.Gd..',
      '.g...gGGGg...g..',
      'g.....gGg.....g.',
      '......gGg.......',
      '.......BB.......',
      '.......BL.......',
      '.......BB.......',
      '.......BL.......',
      '.......BB.......',
      '.......Bb.......',
      '......BBBB......',
      '.....TtTTtT.....',
      '....TTttttTT....',
    ];

    // ---- Sick Palm Tree (16x20) ----
    const treeSick = [
      '................',
      '.....sS.Ss......',
      '....sSSSSSs.....',
      '...sSSSSSSs.....',
      '..s..sSSSs......',
      '.s....sSs.......',
      's.....sSs.......',
      '......sS........',
      '.......BB.......',
      '.......Bb.......',
      '.......BB.......',
      '.......Bb.......',
      '.......BB.......',
      '......BBBB......',
      '.....TtTTtT.....',
      '....TTttttTT....',
    ];

    // ---- Ambiguous Palm Tree (16x20) ----
    const treeAmbiguous = [
      '................',
      '....yYY.YYy.....',
      '...yYYYYYYYy....',
      '..yYYYYYYYYy....',
      '.y..yYYYYy..y...',
      '.y...yYYy...y...',
      '......yYy.......',
      '.......YY.......',
      '.......BB.......',
      '.......BL.......',
      '.......BB.......',
      '.......BL.......',
      '.......BB.......',
      '......BBBB......',
      '.....TtTTtT.....',
      '....TTttttTT....',
    ];

    // ---- Neutral/Empty Plot (16x20) ----
    const treeNeutral = [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '.....TtTTtT.....',
      '....TTttttTT....',
    ];

    // ---- Sprayed/Grey Tree (16x20) ----
    const treeSprayed = [
      '....xX..Xx......',
      '...xXXXXXXx.....',
      '..xXXXXXXXXx....',
      '.xX.xXXXXx.Xx...',
      '.x...xXXx...x...',
      'x.....xXx.....x.',
      '......xXx.......',
      '.......Xz.......',
      '.......Xz.......',
      '.......Xx.......',
      '.......Xz.......',
      '.......Xx.......',
      '.......Xx.......',
      '......XXXX......',
      '.....TtTTtT.....',
      '....TTttttTT....',
    ];

    // Maps are 16 cols x 16 rows
    const mw = treeHealthy[0].length;
    const mh = treeHealthy.length;
    this.cache.treeHealthy = this.create(mw, mh, (ctx) => this.renderMap(ctx, treeHealthy, palette));
    this.cache.treeSick = this.create(mw, mh, (ctx) => this.renderMap(ctx, treeSick, palette));
    this.cache.treeAmbiguous = this.create(mw, mh, (ctx) => this.renderMap(ctx, treeAmbiguous, palette));
    this.cache.treeNeutral = this.create(mw, mh, (ctx) => this.renderMap(ctx, treeNeutral, palette));
    this.cache.treeSprayed = this.create(mw, mh, (ctx) => this.renderMap(ctx, treeSprayed, palette));
  },

  /** Get a cloned sprite canvas for inserting into a cell */
  get(name) {
    const src = this.cache[name];
    if (!src) return null;
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    c.className = 'tree-sprite';
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }
};
