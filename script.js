/* -------- Load Azure Maps API Dynamically -------- */
(function() {
  let mapsLoaded = false;

  window.loadAzureMaps = async function() {
    if (mapsLoaded) return true;
    
    try {
      const response = await fetch('/api/maps-config');
      const data = await response.json();
      
      if (!data.subscriptionKey) {
        console.error('No subscription key received');
        return false;
      }
      
      window.azureMapsSubscriptionKey = data.subscriptionKey;
      
      const mapScript = document.createElement('script');
      mapScript.src = 'https://atlas.microsoft.com/sdk/javascript/mapcontrol/2/atlas.min.js';
      
      await new Promise((resolve, reject) => {
        mapScript.onload = resolve;
        mapScript.onerror = reject;
        document.head.appendChild(mapScript);
      });
      
      const drawScript = document.createElement('script');
      drawScript.src = 'https://atlas.microsoft.com/sdk/javascript/drawing/0/atlas-drawing.min.js';
      
      await new Promise((resolve, reject) => {
        drawScript.onload = () => {
          mapsLoaded = true;
          resolve();
        };
        drawScript.onerror = reject;
        document.head.appendChild(drawScript);
      });
      
      console.log('Azure Maps loaded successfully');
      return true;
    } catch (error) {
      console.error('Error loading Azure Maps:', error);
      return false;
    }
  };
})();

/* -------- Sidebar -------- */
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");

if (sidebarToggle) {
  sidebarToggle.onclick = () => {
    sidebar.classList.toggle("open");
  };
}

/* -------- Panel Navigation -------- */
const panels = document.querySelectorAll(".panel");
let mapInitialized = false;
let map;
let drawingManager;
let activeShape = null;
let areaLabel = null;
let distanceMarkers = [];
let contextLatLng = null;
let distancePath = [];
let distanceDataSource = null;
let measuringDistance = false;

const contextMenu = document.getElementById("contextMenu");
const infoPanel = document.getElementById("infoPanel");

document.querySelectorAll(".sidebar a").forEach(link => {
  link.addEventListener("click", async (e) => {
    e.preventDefault();
    if (sidebar) sidebar.classList.remove("open");

    panels.forEach(p => p.classList.remove("active"));
    const target = document.getElementById(link.dataset.panel);
    if (target) target.classList.add("active");

    if (link.dataset.panel === "mapPanel") {
      if (!mapInitialized) {
        const loaded = await window.loadAzureMaps();
        if (loaded) {
          initMap();
          mapInitialized = true;
        } else {
          alert('Failed to load Azure Maps.');
        }
      } else if (map) {
        map.resize();
      }
    }
  });
});

/* -------- Slope Calculator -------- */
const he = document.getElementById("he");
const le = document.getElementById("le");
const distance = document.getElementById("distance");
const slope = document.getElementById("slope");
const result = document.getElementById("result");
const calculateBtn = document.getElementById("calculateBtn");
const resetBtn = document.getElementById("resetBtn");

if (calculateBtn) {
  calculateBtn.onclick = () => {
    const HE = parseFloat(he.value);
    const LE = parseFloat(le.value);
    const D = parseFloat(distance.value);
    const S = parseFloat(slope.value);

    if ([HE, LE, D, S].filter(v => !isNaN(v)).length < 3) {
      if (result) result.textContent = "⚠️ Enter any 3 values.";
      return;
    }

    if (isNaN(S)) {
      slope.value = (((HE - LE) / D) * 100).toFixed(3);
      if (result) result.textContent = "Slope calculated.";
    } else if (isNaN(D)) {
      distance.value = ((HE - LE) / (S / 100)).toFixed(3);
      if (result) result.textContent = "Distance calculated.";
    } else if (isNaN(HE)) {
      he.value = (LE + D * (S / 100)).toFixed(3);
      if (result) result.textContent = "Higher elevation calculated.";
    } else if (isNaN(LE)) {
      le.value = (HE - D * (S / 100)).toFixed(3);
      if (result) result.textContent = "Lower elevation calculated.";
    }
  };
}

if (resetBtn) {
  resetBtn.onclick = () => {
    if (he) he.value = "";
    if (le) le.value = "";
    if (distance) distance.value = "";
    if (slope) slope.value = "";
    if (result) result.textContent = "";
  };
}

/* -------- Conversion -------- */
const convPercent = document.getElementById("convPercent");
const ratioRise = document.getElementById("ratioRise");
const ratioRun = document.getElementById("ratioRun");
const convAngle = document.getElementById("convAngle");
const convertBtn = document.getElementById("convertBtn");

if (convertBtn) {
  convertBtn.onclick = () => {
    const p = parseFloat(convPercent.value);
    const r = parseFloat(ratioRise.value);
    const run = parseFloat(ratioRun.value);
    const a = parseFloat(convAngle.value);
    const out = document.getElementById("convResult");

    if (!isNaN(p)) {
      const angle = Math.atan(p / 100) * 180 / Math.PI;
      if (out) out.innerHTML = `${p}%<br>Ratio: 1:${(100 / p).toFixed(3)}<br>Angle: ${angle.toFixed(3)}°`;
      return;
    }

    if (!isNaN(r) && !isNaN(run)) {
      const percent = (r / run) * 100;
      const angle = Math.atan(r / run) * 180 / Math.PI;
      if (out) out.innerHTML = `${r}:${run}<br>Percent: ${percent.toFixed(3)}%<br>Angle: ${angle.toFixed(3)}°`;
      return;
    }

    if (!isNaN(a)) {
      const percent = Math.tan(a * Math.PI / 180) * 100;
      if (out) out.innerHTML = `${a}°<br>Percent: ${percent.toFixed(3)}%<br>Ratio: 1:${(100 / percent).toFixed(3)}`;
      return;
    }

    if (out) out.textContent = "⚠️ Enter a value to convert.";
  };
}

/* -------- Azure Map -------- */
function initMap() {
  const mapElement = document.getElementById("map");
  
  if (!mapElement || !window.azureMapsSubscriptionKey) {
    console.error("Map element or subscription key not found");
    return;
  }

  console.log('Initializing map with subscription key');

  map = new atlas.Map('map', {
    center: [78.9629, 20.5937],
    zoom: 4,
    style: 'road',
    view: 'Auto',
    language: 'en-US',
    showFeedbackLink: false,
    showLogo: false,
    authOptions: {
      authType: 'subscriptionKey',
      subscriptionKey: window.azureMapsSubscriptionKey
    }
  });

  map.events.add('ready', function() {
    console.log('Map is ready!');
    
    // Add scale bar control (Feature 4)
    map.controls.add(new atlas.control.ScaleControl({
      maxBarLength: 100,
      units: 'metric'
    }), {
      position: 'bottom-left'
    });
    
    // Initialize drawing manager WITHOUT toolbar
    drawingManager = new atlas.drawing.DrawingManager(map, {
      toolbar: new atlas.control.DrawingToolbar({
        buttons: [],  // No buttons - we'll use custom menu
        position: 'top-right',
        style: 'light',
        visible: false
      }),
      freehandInterval: 3,
      snapDistance: 15,
      // Fix for editing - ensure polygon stays visible
      shapeDraggingOptions: {
        visible: true
      }
    });

    // Handle shape completion
    map.events.add('drawingcomplete', drawingManager, function(shape) {
      if (activeShape) {
        drawingManager.getSource().remove(activeShape);
      }
      if (areaLabel) {
        map.markers.remove(areaLabel);
      }

      activeShape = shape;
      displayAreaOnShape(shape);
      
      // Stop drawing mode after completion
      drawingManager.setOptions({ mode: 'idle' });
    });

    // Update area when shape is edited
    map.events.add('drawingchanged', drawingManager, function(shape) {
      if (shape === activeShape) {
        displayAreaOnShape(shape);
      }
    });

    if (contextMenu) {
      map.events.add('contextmenu', function(e) {
        e.preventDefault();
        contextLatLng = e.position;

        const pixel = map.positionsToPixels([e.position])[0];
        contextMenu.style.left = pixel[0] + 'px';
        contextMenu.style.top = pixel[1] + 'px';
        contextMenu.style.display = 'block';
      });

      map.events.add('click', function(e) {
        if (contextMenu.style.display === 'block') {
          contextMenu.style.display = 'none';
        }

        if (measuringDistance && e.position) {
          contextLatLng = e.position;
          distancePath.push(e.position);
          updateDistanceLine();
        }
      });

      document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target) && !mapElement.contains(e.target)) {
          contextMenu.style.display = 'none';
        }
      });
    }
  });
  
  map.events.add('error', function(e) {
    console.error('Map error:', e);
  });
}

// Calculate polygon area using Shoelace formula
function calculatePolygonArea(coordinates) {
  if (coordinates.length < 3) return 0;
  
  let area = 0;
  const numPoints = coordinates.length;
  
  for (let i = 0; i < numPoints - 1; i++) {
    const p1 = coordinates[i];
    const p2 = coordinates[i + 1];
    area += (p1[0] * p2[1]) - (p2[0] * p1[1]);
  }
  
  const p1 = coordinates[numPoints - 1];
  const p2 = coordinates[0];
  area += (p1[0] * p2[1]) - (p2[0] * p1[1]);
  
  area = Math.abs(area) / 2;
  
  const metersPerDegreeLat = 111320;
  const avgLat = coordinates.reduce((sum, coord) => sum + coord[1], 0) / coordinates.length;
  const metersPerDegreeLon = metersPerDegreeLat * Math.cos(avgLat * Math.PI / 180);
  
  area = area * metersPerDegreeLat * metersPerDegreeLon;
  
  return area;
}

// Display area label inside the shape (Feature 2 - added sq ft)
function displayAreaOnShape(shape) {
  if (!shape) return;
  
  if (areaLabel) {
    map.markers.remove(areaLabel);
  }
  
  const geometry = shape.toJson().geometry;
  let area = 0;
  let center = null;
  
  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates[0];
    area = calculatePolygonArea(coords);
    
    let sumLng = 0, sumLat = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      sumLng += coords[i][0];
      sumLat += coords[i][1];
    }
    center = [sumLng / (coords.length - 1), sumLat / (coords.length - 1)];
  }
  
  if (center && area > 0) {
    const areaM2 = area.toFixed(2);
    const areaSqFt = (area * 10.7639).toFixed(2);  // Convert m² to sq ft
    const areaHa = (area / 10000).toFixed(4);
    const areaAcres = (area * 0.000247105).toFixed(4);
    
    const htmlContent = `
      <div style="
        background: rgba(255, 255, 255, 0.95);
        padding: 10px 14px;
        border-radius: 8px;
        box-shadow: 0 3px 12px rgba(0,0,0,0.4);
        font-family: system-ui, Arial, sans-serif;
        font-size: 12px;
        font-weight: 600;
        color: #333;
        text-align: center;
        white-space: nowrap;
        border: 2px solid #007bff;
        pointer-events: none;
      ">
        <div style="font-size: 14px; color: #007bff; margin-bottom: 4px;">📐 Area</div>
        <div style="margin: 2px 0;">${areaM2} m² / ${areaSqFt} ft²</div>
        <div style="font-size: 10px; color: #666; margin-top: 4px;">${areaHa} ha | ${areaAcres} acres</div>
      </div>
    `;
    
    areaLabel = new atlas.HtmlMarker({
      position: center,
      htmlContent: htmlContent,
      pixelOffset: [0, 0]
    });
    
    map.markers.add(areaLabel);
  }
}

// Feature 3: Update distance line with markers and labels
function updateDistanceLine() {
  if (!distanceDataSource || distancePath.length === 0) return;
  
  // Clear old markers
  distanceMarkers.forEach(marker => map.markers.remove(marker));
  distanceMarkers = [];
  
  distanceDataSource.clear();
  
  // Draw line
  const line = new atlas.data.LineString(distancePath);
  distanceDataSource.add(new atlas.data.Feature(line));
  
  // Add markers and labels for each segment
  let totalDistance = 0;
  
  for (let i = 0; i < distancePath.length; i++) {
    // Add vertex marker
    const vertexMarker = new atlas.HtmlMarker({
      position: distancePath[i],
      htmlContent: `
        <div style="
          width: 12px;
          height: 12px;
          background: white;
          border: 3px solid red;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        "></div>
      `,
      pixelOffset: [0, 0]
    });
    map.markers.add(vertexMarker);
    distanceMarkers.push(vertexMarker);
    
    // Add distance label for each segment
    if (i > 0) {
      const pos1 = new atlas.data.Position(distancePath[i-1][0], distancePath[i-1][1]);
      const pos2 = new atlas.data.Position(distancePath[i][0], distancePath[i][1]);
      const segmentDistance = atlas.math.getDistanceTo(pos1, pos2);
      totalDistance += segmentDistance;
      
      // Midpoint of segment
      const midLng = (distancePath[i-1][0] + distancePath[i][0]) / 2;
      const midLat = (distancePath[i-1][1] + distancePath[i][1]) / 2;
      
      const distLabel = new atlas.HtmlMarker({
        position: [midLng, midLat],
        htmlContent: `
          <div style="
            background: rgba(255, 255, 255, 0.95);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            color: #d32f2f;
            border: 1px solid #d32f2f;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            white-space: nowrap;
          ">
            ${segmentDistance.toFixed(1)} m
          </div>
        `,
        pixelOffset: [0, -20]
      });
      map.markers.add(distLabel);
      distanceMarkers.push(distLabel);
    }
  }
  
  // Total distance marker at end
  if (distancePath.length > 1) {
    const totalLabel = new atlas.HtmlMarker({
      position: distancePath[distancePath.length - 1],
      htmlContent: `
        <div style="
          background: rgba(211, 47, 47, 0.95);
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          color: white;
          box-shadow: 0 3px 8px rgba(0,0,0,0.3);
          white-space: nowrap;
        ">
          Total: ${totalDistance.toFixed(2)} m
        </div>
      `,
      pixelOffset: [0, 20]
    });
    map.markers.add(totalLabel);
    distanceMarkers.push(totalLabel);
  }
}

function showInfo(html) {
  if (infoPanel) {
    infoPanel.innerHTML = html;
    infoPanel.style.display = "block";
  }
}

function hideInfo() {
  if (infoPanel) {
    infoPanel.style.display = "none";
  }
}

function getShapeArea(shape) {
  if (!shape) return 0;
  
  const geometry = shape.toJson().geometry;
  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates[0];
    return calculatePolygonArea(coords);
  }
  return 0;
}

// Add this after the updateDistanceLine function

// HIGH-RESOLUTION EXPORT - Feature Request
async function exportHighResolution() {
  if (!activeShape) {
    showInfo("⚠️ Draw a polygon or rectangle first.");
    return;
  }

  showInfo("🔄 Generating high-resolution export...<br>This may take a moment.");

  try {
    // Get bounds of the shape
    const geometry = activeShape.toJson().geometry;
    const coords = geometry.coordinates[0];
    
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;
    
    coords.forEach(coord => {
      minLng = Math.min(minLng, coord[0]);
      maxLng = Math.max(maxLng, coord[0]);
      minLat = Math.min(minLat, coord[1]);
      maxLat = Math.max(maxLat, coord[1]);
    });
    
    const bounds = {
      north: maxLat,
      south: minLat,
      east: maxLng,
      west: minLng
    };
    
    // Calculate zoom level based on area size
    const lngDiff = maxLng - minLng;
    const latDiff = maxLat - minLat;
    const maxDiff = Math.max(lngDiff, latDiff);
    
    // Determine optimal zoom (higher for smaller areas)
    let targetZoom;
    if (maxDiff < 0.001) targetZoom = 20;        // Very small area
    else if (maxDiff < 0.01) targetZoom = 18;    // Small area
    else if (maxDiff < 0.1) targetZoom = 16;     // Medium area
    else if (maxDiff < 1) targetZoom = 14;       // Large area
    else targetZoom = 12;                         // Very large area
    
    // Calculate tiles needed
    const tiles = calculateTilesForBounds(bounds, targetZoom);
    
    if (tiles.length > 50) {
      showInfo(`⚠️ Area too large! Would require ${tiles.length} tiles.<br>Try a smaller area.`);
      return;
    }
    
    showInfo(`📦 Fetching ${tiles.length} tiles at zoom level ${targetZoom}...`);
    
    // Fetch all tiles
    const tileSize = 512;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Calculate canvas size
    const xTiles = new Set(tiles.map(t => t.x)).size;
    const yTiles = new Set(tiles.map(t => t.y)).size;
    canvas.width = xTiles * tileSize;
    canvas.height = yTiles * tileSize;
    
    const minX = Math.min(...tiles.map(t => t.x));
    const minY = Math.min(...tiles.map(t => t.y));
    
    // Fetch and draw tiles
    let completed = 0;
    for (const tile of tiles) {
      try {
        const img = await fetchMapTile(tile.x, tile.y, targetZoom);
        const offsetX = (tile.x - minX) * tileSize;
        const offsetY = (tile.y - minY) * tileSize;
        ctx.drawImage(img, offsetX, offsetY, tileSize, tileSize);
        
        completed++;
        showInfo(`📦 Progress: ${completed}/${tiles.length} tiles loaded...`);
      } catch (err) {
        console.error('Tile fetch error:', err);
      }
    }
    
    // Crop to actual bounds
    const croppedCanvas = cropCanvasToBounds(canvas, bounds, targetZoom, minX, minY, tileSize);
    
    // Download
    croppedCanvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `map_highres_${Date.now()}.png`;
      a.click();
      showInfo(`✅ High-resolution export complete!<br>Size: ${croppedCanvas.width}x${croppedCanvas.height}px`);
    });
    
  } catch (err) {
    console.error('Export error:', err);
    showInfo("❌ High-res export failed: " + err.message);
  }
}

// Calculate tile coordinates for bounds
function calculateTilesForBounds(bounds, zoom) {
  const tiles = [];
  const topLeft = latLngToTileCoords(bounds.north, bounds.west, zoom);
  const bottomRight = latLngToTileCoords(bounds.south, bounds.east, zoom);
  
  for (let x = topLeft.x; x <= bottomRight.x; x++) {
    for (let y = topLeft.y; y <= bottomRight.y; y++) {
      tiles.push({ x, y, zoom });
    }
  }
  
  return tiles;
}

// Convert lat/lng to tile coordinates
function latLngToTileCoords(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const xTile = Math.floor((lng + 180) / 360 * n);
  const yTile = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
  return { x: xTile, y: yTile };
}

// Fetch a single map tile
function fetchMapTile(x, y, zoom) {
  return new Promise((resolve, reject) => {
    const style = currentStyle === 'satellite' ? 'satellite_road_labels' : 'road';
    
    // Use Azure Maps tile API
    const url = `https://atlas.microsoft.com/map/tile?` +
      `api-version=2.2` +
      `&tilesetId=microsoft.base.${style}` +
      `&zoom=${zoom}` +
      `&x=${x}` +
      `&y=${y}` +
      `&tileSize=512` +
      `&subscription-key=${window.azureMapsSubscriptionKey}`;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load tile ${x},${y}`));
    
    img.src = url;
  });
}

// Crop canvas to exact bounds
function cropCanvasToBounds(canvas, bounds, zoom, minX, minY, tileSize) {
  // Calculate pixel coordinates within the tile grid
  const topLeft = latLngToPixelCoords(bounds.north, bounds.west, zoom, tileSize);
  const bottomRight = latLngToPixelCoords(bounds.south, bounds.east, zoom, tileSize);
  
  const offsetX = topLeft.x - (minX * tileSize);
  const offsetY = topLeft.y - (minY * tileSize);
  const width = bottomRight.x - topLeft.x;
  const height = bottomRight.y - topLeft.y;
  
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = width;
  croppedCanvas.height = height;
  const ctx = croppedCanvas.getContext('2d');
  
  ctx.drawImage(canvas, offsetX, offsetY, width, height, 0, 0, width, height);
  
  return croppedCanvas;
}

// Convert lat/lng to pixel coordinates
function latLngToPixelCoords(lat, lng, zoom, tileSize) {
  const n = Math.pow(2, zoom);
  const x = (lng + 180) / 360 * n * tileSize;
  const y = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n * tileSize;
  return { x: Math.floor(x), y: Math.floor(y) };
}

// Feature 5 & 7: Clear function
function clearAllShapes() {
  if (activeShape && drawingManager) {
    drawingManager.getSource().remove(activeShape);
    activeShape = null;
  }
  if (areaLabel) {
    map.markers.remove(areaLabel);
    areaLabel = null;
  }
  if (distanceDataSource) {
    distanceDataSource.clear();
  }
  distanceMarkers.forEach(marker => map.markers.remove(marker));
  distanceMarkers = [];
  distancePath = [];
  measuringDistance = false;
}

const clearShapeBtn = document.getElementById("clearShape");
if (clearShapeBtn) {
  clearShapeBtn.onclick = clearAllShapes;
}

// Feature 6: Smaller, different style toggle button
const toggleStyleBtn = document.getElementById("toggleStyle");
let currentStyle = 'road';
let isChangingStyle = false;

if (toggleStyleBtn) {
  // Apply compact styling
  toggleStyleBtn.style.minWidth = '100px';
  toggleStyleBtn.style.fontSize = '11px';
  toggleStyleBtn.style.padding = '6px 10px';
  
  toggleStyleBtn.onclick = () => {
    if (!map || isChangingStyle) return;
    
    isChangingStyle = true;
    toggleStyleBtn.disabled = true;
    
    if (currentStyle === 'road') {
      map.setStyle({ style: 'satellite_road_labels' });
      currentStyle = 'satellite';
      toggleStyleBtn.textContent = '🗺️ Road';
      toggleStyleBtn.style.background = '#2e7d32';
    } else {
      map.setStyle({ style: 'road' });
      currentStyle = 'road';
      toggleStyleBtn.textContent = '🛰️ Satellite';
      toggleStyleBtn.style.background = '#007bff';
    }
    
    setTimeout(() => {
      isChangingStyle = false;
      toggleStyleBtn.disabled = false;
    }, 1000);
  };
}

if (contextMenu) {
  contextMenu.addEventListener("click", e => {
    const action = e.target.dataset.action;
    contextMenu.style.display = "none";

    if (!action || !contextLatLng) return;

    const lng = contextLatLng[0];
    const lat = contextLatLng[1];

    // Feature 7: Drawing tools submenu
    if (action === "drawTools") {
      showInfo(`
        <div style="font-weight: 600; margin-bottom: 8px;">📐 Drawing Tools</div>
        <button onclick="drawingManager.setOptions({ mode: 'draw-polygon' }); hideInfo();" 
          style="width: 100%; margin: 4px 0; padding: 8px; border: none; background: #007bff; color: white; border-radius: 4px; cursor: pointer;">
          🔷 Draw Polygon
        </button>
        <button onclick="drawingManager.setOptions({ mode: 'draw-rectangle' }); hideInfo();" 
          style="width: 100%; margin: 4px 0; padding: 8px; border: none; background: #007bff; color: white; border-radius: 4px; cursor: pointer;">
          ⬜ Draw Rectangle
        </button>
        <button onclick="drawingManager.setOptions({ mode: 'edit-geometry' }); hideInfo();" 
          style="width: 100%; margin: 4px 0; padding: 8px; border: none; background: #2e7d32; color: white; border-radius: 4px; cursor: pointer;">
          ✏️ Edit Geometry
        </button>
      `);
      return;
    }

    // Feature 5: Clear in context menu
    if (action === "clear") {
      clearAllShapes();
      showInfo("✅ All shapes cleared!");
      setTimeout(hideInfo, 2000);
      return;
    }

    if (action === "coords") {
      showInfo(`
        <b>Coordinates</b><br>
        Latitude: ${lat.toFixed(6)}<br>
        Longitude: ${lng.toFixed(6)}
      `);
    }

    if (action === "area") {
      if (!activeShape) {
        showInfo("⚠️ Draw a polygon or rectangle first.");
        return;
      }

      const area = getShapeArea(activeShape);
      const areaSqFt = (area * 10.7639).toFixed(2);
      showInfo(`
        <b>Area Details</b><br>
        ${area.toFixed(2)} m²<br>
        ${areaSqFt} ft²<br>
        ${(area / 10000).toFixed(4)} ha<br>
        ${(area * 0.000247105).toFixed(4)} acres
      `);
    }

    if (action === "startDistance") {
      measuringDistance = true;
      distancePath = [];
      distanceMarkers.forEach(marker => map.markers.remove(marker));
      distanceMarkers = [];
      
      if (!distanceDataSource) {
        distanceDataSource = new atlas.source.DataSource();
        map.sources.add(distanceDataSource);
        
        map.layers.add(new atlas.layer.LineLayer(distanceDataSource, null, {
          strokeColor: 'red',
          strokeWidth: 3
        }));
      } else {
        distanceDataSource.clear();
      }
      
      showInfo("📏 Distance measurement started.<br>Click to add points.<br>Right-click → Finish to complete.");
    }

    if (action === "finishDistance") {
      measuringDistance = false;
      if (distancePath.length > 1) {
        let totalDistance = 0;
        
        for (let i = 0; i < distancePath.length - 1; i++) {
          const pos1 = new atlas.data.Position(distancePath[i][0], distancePath[i][1]);
          const pos2 = new atlas.data.Position(distancePath[i+1][0], distancePath[i+1][1]);
          totalDistance += atlas.math.getDistanceTo(pos1, pos2);
        }
        
        showInfo(`
          <b>Total Distance</b><br>
          ${totalDistance.toFixed(2)} m<br>
          ${(totalDistance / 1000).toFixed(3)} km<br>
          ${(totalDistance * 3.28084).toFixed(2)} ft<br>
          ${(totalDistance * 0.000621371).toFixed(3)} miles
        `);
      } else {
        showInfo("⚠️ Click at least 2 points to measure.");
      }
    }

    if (action === "export") {
      if (!activeShape) {
        showInfo("⚠️ Draw an area first.");
        return;
      }

      // Show export options
      showInfo(`
        <div style="font-weight: 600; margin-bottom: 8px;">💾 Export Options</div>
        <button onclick="exportStandardResolution(); hideInfo();" 
          style="width: 100%; margin: 4px 0; padding: 8px; border: none; background: #007bff; color: white; border-radius: 4px; cursor: pointer;">
          📷 Standard Export (Fast)
        </button>
        <button onclick="exportHighResolution(); hideInfo();" 
          style="width: 100%; margin: 4px 0; padding: 8px; border: none; background: #2e7d32; color: white; border-radius: 4px; cursor: pointer;">
          🎯 High-Res Export (Slow, Better Quality)
      </button>
    `);
     return;
  }

  // Add this function for standard export
  function exportStandardResolution() {
   const center = map.getCamera().center;
   const zoom = map.getCamera().zoom;
   const mapType = map.getStyle().style;

   fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      center: center,
      zoom: Math.round(zoom),
      mapType: mapType.includes('satellite') ? 'satellite' : 'road'
    })
  })
    .then(res => {
      if (!res.ok) throw new Error('Export failed');
      return res.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "map_export.png";
      a.click();
      showInfo("✅ Map exported successfully!");
    })
    .catch((err) => {
      console.error(err);
      showInfo("❌ Export failed.");
    });
}
  });
}
