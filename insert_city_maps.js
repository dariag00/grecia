const fs = require('fs');

const data = JSON.parse(fs.readFileSync('C:/Users/mclit/Downloads/city_maps_data.json'));

const CITY_META = {
  athens:   { title: 'Atenas',    subtitle: 'La cuna de todo',           insertBefore: '    <!-- INTRO PAROS -->',     tileFilter: '' },
  paros:    { title: 'Paros',     subtitle: 'La isla tranquila',         insertBefore: '    <!-- INTRO SANTORINI -->', tileFilter: '' },
  santorini:{ title: 'Santorini', subtitle: 'Lo que queda de un volcán', insertBefore: '    <!-- PÁG 5: DÍAS SANTORINI -->', tileFilter: '' },
};

function buildMapPage(cityKey) {
  const city = data[cityKey];
  const meta = CITY_META[cityKey];
  const { tilesW, tilesH, tiles, pois } = city;

  // Tile grid — float layout fills width, height auto from square tiles
  const tileImgs = tiles.map(b64 =>
    `<img src="data:image/png;base64,${b64}" style="display:block;width:${(100/tilesW).toFixed(6)}%;float:left;">`
  ).join('');

  // CRITICAL FIX: marker container must have same height as tile grid.
  // Grid height = (tilesH / tilesW) × 100% of page width.
  // Since the page is 148mm wide and tiles are square, grid height = tilesH/tilesW × 148mm.
  // We express this as a percentage of width using the padding-top trick.
  const gridAspectPct = (tilesH / tilesW * 100).toFixed(4); // e.g. 150% for 6/4

  // Markers — X/Y are percentages of the tile grid dimensions (correct because
  // the marker container uses the same aspect as the grid)
  const markers = pois.map(poi => {
    const { x, y } = poi.pos;
    if (x < 2 || x > 98 || y < 2 || y > 98) return ''; // outside grid

    // Adjust label side to avoid clipping at horizontal edges
    const flexDir = x > 72 ? 'row-reverse' : 'row';
    const marginSide = x > 72 ? 'marginRight' : 'marginLeft';

    return `<div style="position:absolute;left:${x}%;top:${y}%;transform:translate(-50%,-50%);">
        <div style="display:flex;flex-direction:${flexDir};align-items:center;gap:3px;">
          <div style="width:10px;height:10px;background:${poi.color};border-radius:50%;border:2.5px solid white;box-shadow:0 1px 5px rgba(0,0,0,0.5);flex-shrink:0;"></div>
          <div style="background:white;color:${poi.color};font-size:6pt;font-weight:700;padding:2px 5px;border-radius:3px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3);">${poi.label}</div>
        </div>
      </div>`;
  }).join('');

  return `    <!-- MAPA ${cityKey.toUpperCase()} -->
    <div class="pg" style="height:210mm;min-height:210mm;overflow:hidden;">
      <!-- tile grid, full bleed -->
      <div style="position:absolute;inset:0;overflow:hidden;z-index:0;line-height:0;${meta.tileFilter ? `filter:${meta.tileFilter};` : ''}">
        ${tileImgs}
        <div style="clear:both;"></div>
      </div>
      <!-- marker overlay: same aspect ratio as tile grid so % coords align perfectly -->
      <div style="position:absolute;top:0;left:0;width:100%;height:0;padding-top:${gridAspectPct}%;overflow:visible;z-index:2;">
        <div style="position:absolute;inset:0;">
          ${markers}
        </div>
      </div>
      <!-- top gradient + title -->
      <div style="position:absolute;top:0;left:0;right:0;z-index:4;background:linear-gradient(to bottom,rgba(10,37,64,0.80) 0%,rgba(10,37,64,0.45) 55%,transparent 100%);padding:10px 12mm 20px;">
        <div style="font-size:5.5pt;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:rgba(191,239,246,0.65);margin-bottom:3px;">Grecia 2026 · Mapa</div>
        <div style="font-family:'Playfair Display',Georgia,serif;font-size:18pt;font-weight:900;color:white;line-height:1;">${meta.title}</div>
        <div style="font-size:7pt;font-weight:300;color:rgba(191,239,246,0.8);letter-spacing:0.5px;margin-top:2px;">${meta.subtitle}</div>
      </div>
      <!-- bottom gradient + legend + footer -->
      <div style="position:absolute;bottom:0;left:0;right:0;z-index:4;background:linear-gradient(to top,rgba(10,37,64,0.82) 0%,rgba(10,37,64,0.5) 65%,transparent 100%);padding:20px 12mm 7px;">
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:5px;">
          <div style="display:flex;align-items:center;gap:4px;">
            <div style="width:8px;height:8px;border-radius:50%;background:#1a73e8;border:1.5px solid rgba(255,255,255,0.6);flex-shrink:0;"></div>
            <span style="font-size:5.5pt;color:rgba(255,255,255,0.8);">Lugares de interés</span>
          </div>
          <div style="display:flex;align-items:center;gap:4px;">
            <div style="width:8px;height:8px;border-radius:50%;background:#e8a91a;border:1.5px solid rgba(255,255,255,0.6);flex-shrink:0;"></div>
            <span style="font-size:5.5pt;color:rgba(255,255,255,0.8);">Barrios</span>
          </div>
          <div style="display:flex;align-items:center;gap:4px;">
            <div style="width:8px;height:8px;border-radius:50%;background:#d93025;border:1.5px solid rgba(255,255,255,0.6);flex-shrink:0;"></div>
            <span style="font-size:5.5pt;color:rgba(255,255,255,0.8);">Hotel / Imprescindible</span>
          </div>
        </div>
        <div style="font-size:5.5pt;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:rgba(191,239,246,0.4);">Los 6 Meowlundus</div>
      </div>
    </div>`;
}

// Read and patch HTML
let html = fs.readFileSync('C:/Users/mclit/grecia/grecia_librillo_a5.html', 'utf8');

// Remove old Paros map page (stop before INTRO SANTORINI so intro is preserved)
html = html.replace(/\s*<!-- MAPA PAROS -->[\s\S]*?(?=\s*<!-- INTRO SANTORINI)/, '');

// Insert fresh Paros page
const page = buildMapPage('paros');
const marker = CITY_META['paros'].insertBefore;
html = html.replace(marker, page + '\n' + marker);

fs.writeFileSync('C:/Users/mclit/grecia/grecia_librillo_a5.html', html);
console.log('Done — Paros map page updated in grecia_librillo_a5.html');
