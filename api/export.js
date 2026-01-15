export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { center, zoom, mapType } = req.body;
    const API_KEY = process.env.AZURE_MAPS_KEY;

    if (!API_KEY) {
      return res.status(500).json({ error: "API key missing" });
    }

    // Azure Maps Static Image API
    // Format: center is [longitude, latitude]
    const style = mapType === 'satellite' ? 'satellite_road_labels' : 'road';
    
    const url = `https://atlas.microsoft.com/map/static/png` +
      `?subscription-key=${API_KEY}` +
      `&api-version=2.0` +
      `&layer=basic` +
      `&style=${style}` +
      `&zoom=${zoom}` +
      `&center=${center[0]},${center[1]}` + // longitude, latitude
      `&width=1280` +
      `&height=1280`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Azure Maps API error: ${response.status}`);
    }
    
    const buffer = await response.arrayBuffer();

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ error: "Export failed", details: err.message });
  }
}
