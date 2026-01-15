export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { bounds, maxZoom, mapType } = req.body;
    const API_KEY = process.env.AZURE_MAPS_SUBSCRIPTION_KEY;

    if (!API_KEY) {
      return res.status(500).json({ error: "API key missing" });
    }

    // bounds: { north, south, east, west }
    const style = mapType === 'satellite' ? 'satellite_road_labels' : 'road';
    
    // Calculate optimal zoom level (max 20 for Azure Maps)
    const zoom = Math.min(maxZoom || 18, 20);
    
    // Calculate tile coordinates for the bounding box
    const tiles = calculateTilesToFetch(bounds, zoom);
    
    // Fetch all tiles
    const tilePromises = tiles.map(tile => 
      fetchTile(tile.x, tile.y, zoom, style, API_KEY)
    );
    
    const tileImages = await Promise.all(tilePromises);
    
    // Stitch tiles together
    const stitchedImage = await stitchTiles(tileImages, tiles);
    
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(stitchedImage);
    
  } catch (err) {
    console.error("High-res export error:", err);
    res.status(500).json({ error: "Export failed", details: err.message });
  }
}

// Convert lat/lng to tile coordinates
function latLonToTile(lat, lon, zoom) {
  const n = Math.pow(2, zoom);
  const xTile = Math.floor((lon + 180) / 360 * n);
  const yTile = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
  return { x: xTile, y: yTile };
}

// Calculate all tiles needed for bounding box
function calculateTilesToFetch(bounds, zoom) {
  const topLeft = latLonToTile(bounds.north, bounds.west, zoom);
  const bottomRight = latLonToTile(bounds.south, bounds.east, zoom);
  
  const tiles = [];
  for (let x = topLeft.x; x <= bottomRight.x; x++) {
    for (let y = topLeft.y; y <= bottomRight.y; y++) {
      tiles.push({ x, y, zoom });
    }
  }
  
  return tiles;
}

// Fetch a single tile
async function fetchTile(x, y, zoom, style, apiKey) {
  const url = `https://atlas.microsoft.com/map/tile?` +
    `api-version=2.2` +
    `&tilesetId=microsoft.base.${style}` +
    `&zoom=${zoom}` +
    `&x=${x}` +
    `&y=${y}` +
    `&tileSize=512` +
    `&subscription-key=${apiKey}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch tile ${x},${y}`);
  }
  
  return {
    buffer: await response.arrayBuffer(),
    x,
    y
  };
}

// Stitch tiles together using canvas (server-side)
async function stitchTiles(tileImages, tiles) {
  // This requires a canvas library on server
  // For now, return the first tile as placeholder
  // We'll implement client-side stitching instead
  return Buffer.from(tileImages[0].buffer);
}
