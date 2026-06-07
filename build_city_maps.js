const https = require('https');
const fs = require('fs');

function latLonToTileXY(lat, lon, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

function latLonToPercent(lat, lon, zoom, gridX, gridY, tilesW, tilesH) {
  const n = Math.pow(2, zoom);
  const px = ((lon + 180) / 360 * n - gridX) / tilesW * 100;
  const latRad = lat * Math.PI / 180;
  const pyTotal = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
  const py = (pyTotal - gridY) / tilesH * 100;
  return { x: Math.round(px * 10) / 10, y: Math.round(py * 10) / 10 };
}

async function downloadTile(style, zoom, x, y) {
  const base = 'https://cartodb-basemaps-a.global.ssl.fastly.net';
  const urls = {
    voyager:     [`${base}/rastertiles/voyager/${zoom}/${x}/${y}.png`,     `${base.replace('-a.','-b.')}/rastertiles/voyager/${zoom}/${x}/${y}.png`],
    osm:         [`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`],
    // Esri World Street Map — Google Maps look-alike, blue water, no ferry routes, free
    esri:        [`https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${y}/${x}`],
    dark_matter: [`https://a.basemaps.cartocdn.com/dark_all/${zoom}/${x}/${y}.png`, `https://b.basemaps.cartocdn.com/dark_all/${zoom}/${x}/${y}.png`],
  }[style];

  for (const url of urls) {
    try {
      const data = await new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'grecia-librillo/1.0' } }, (res) => {
          if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', reject);
        }).on('error', reject);
      });
      if (data.length > 50) return data;
    } catch (e) { /* try next */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`Could not download ${style} tile ${zoom}/${x}/${y}`);
}

async function buildCityMap(cfg) {
  const { name, style, zoom, centerLat, centerLon, tilesW, tilesH, verticalOffset, pois } = cfg;
  const center = latLonToTileXY(centerLat, centerLon, zoom);
  const gridX = center.x - Math.floor(tilesW / 2);
  const gridY = center.y - Math.floor(tilesH * (verticalOffset ?? 0.5));
  console.log(`\n=== ${name} [${style}] zoom${zoom} (${tilesW}x${tilesH}) grid=(${gridX},${gridY})`);

  const tiles = [];
  for (let row = 0; row < tilesH; row++) {
    for (let col = 0; col < tilesW; col++) {
      const tx = gridX + col, ty = gridY + row;
      process.stdout.write(`  ${zoom}/${tx}/${ty}... `);
      await new Promise(r => setTimeout(r, 250));
      const buf = await downloadTile(style, zoom, tx, ty);
      tiles.push(buf.toString('base64'));
      console.log(`${(buf.length / 1024).toFixed(1)}KB`);
    }
  }

  const poiPositions = pois.map(p => ({
    ...p,
    pos: latLonToPercent(p.lat, p.lon, zoom, gridX, gridY, tilesW, tilesH)
  }));

  console.log('  POIs:');
  poiPositions.forEach(p => {
    const ok = p.pos.x >= 2 && p.pos.x <= 98 && p.pos.y >= 2 && p.pos.y <= 98 ? '✓' : '✗ OUT';
    console.log(`    ${ok} ${p.label.padEnd(20)} x=${p.pos.x.toFixed(1)}%  y=${p.pos.y.toFixed(1)}%`);
  });

  return { name, style, tilesW, tilesH, tiles, pois: poiPositions };
}

const CITIES = [
  {
    name: 'paros',
    style: 'osm',
    zoom: 13,
    centerLat: 37.0800,
    centerLon: 25.1900,
    tilesW: 4,
    tilesH: 6,
    verticalOffset: 0.5,
    pois: [
      { label: 'Parikia 🛳️',  lat: 37.0847, lon: 25.1489, color: '#1a73e8' },
      { label: 'Naoussa',      lat: 37.1231, lon: 25.2330, color: '#1a73e8' },
      { label: 'Golden Beach', lat: 37.0337, lon: 25.2137, color: '#e8a91a' },
      { label: 'Aliki',        lat: 37.0209, lon: 25.1774, color: '#e8a91a' },
    ]
  },
  {
    name: 'santorini',
    style: 'osm',
    zoom: 13,
    centerLat: 36.4070,
    centerLon: 25.4250,
    tilesW: 4,
    tilesH: 6,
    verticalOffset: 0.5,
    pois: [
      { label: 'Fira',           lat: 36.4168, lon: 25.4316, color: '#1a73e8' },
      { label: 'Oia',            lat: 36.4618, lon: 25.3751, color: '#e8a91a' },
      { label: 'Akrotiri',       lat: 36.3522, lon: 25.4040, color: '#1a73e8' },
      { label: 'Pyrgos ★',      lat: 36.3917, lon: 25.4469, color: '#d93025' },
      { label: 'Santo Wines',    lat: 36.3878, lon: 25.3967, color: '#e8a91a' },
      { label: 'Puerto ⚓',      lat: 36.3939, lon: 25.4346, color: '#1a73e8' },
      { label: 'Aeropuerto ✈️', lat: 36.3992, lon: 25.4793, color: '#1a73e8' },
    ]
  }
];

async function main() {
  let data = {};
  try { data = JSON.parse(fs.readFileSync('C:/Users/mclit/Downloads/city_maps_data.json')); } catch(e) {}
  for (const cfg of CITIES) {
    data[cfg.name] = await buildCityMap(cfg);
    fs.writeFileSync('C:/Users/mclit/Downloads/city_maps_data.json', JSON.stringify(data));
  }
  console.log('\nDone → city_maps_data.json');
}

main().catch(e => { console.error(e); process.exit(1); });
