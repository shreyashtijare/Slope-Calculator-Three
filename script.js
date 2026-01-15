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
const exportModal = document.getElementById("exportModal");
const exportEstimate = document.getElementById("exportEstimate");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const startExportBtn = document.getElementById("startExportBtn");
const cancelExportBtn = document.getElementById("cancelExportBtn");

let mockProgressTimer = null;


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

// Feature 5.1: Estimate export parameters
function metersPerPixel(lat, zoom) {
  return (
    156543.03392 *
    Math.cos((lat * Math.PI) / 180) /
    Math.pow(2, zoom)
  );
}

// Feature 5.2 : Mock Progress Driver
function startMockProgress(totalTiles) {
  let completed = 0;
  exportEstimate.innerHTML += "<br><br>Exporting…";

  mockProgressTimer = setInterval(() => {
    completed++;
    const percent = Math.round((completed / totalTiles) * 100);

    progressBar.style.width = percent + "%";
    progressText.textContent = `Rendering tile ${completed} of ${totalTiles}`;

    if (completed >= totalTiles) {
      clearInterval(mockProgressTimer);
      progressText.textContent = "Export ready (mock).";
    }
  }, 150);
}

function closeExportModal() {
  exportModal.style.display = "none";
  clearInterval(mockProgressTimer);
}

function estimateExport(bounds) {
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const centerLat = (ne.lat() + sw.lat()) / 2;

  // Approx distances in meters
  const widthMeters =
    google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(ne.lat(), sw.lng()),
      ne
    );
  const heightMeters =
    google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(sw.lat(), ne.lng()),
      ne
    );

  let chosenZoom = 21;
  let pixelWidth, pixelHeight;

  while (chosenZoom > 14) {
    const mpp = metersPerPixel(centerLat, chosenZoom);
    pixelWidth = widthMeters / mpp;
    pixelHeight = heightMeters / mpp;

    if (pixelWidth < 12000 && pixelHeight < 12000) break;
    chosenZoom--;
  }

  const tilesX = Math.ceil(pixelWidth / 1280);
  const tilesY = Math.ceil(pixelHeight / 1280);

  return {
    zoom: chosenZoom,
    pixelWidth: Math.round(pixelWidth),
    pixelHeight: Math.round(pixelHeight),
    tilesX,
    tilesY,
    totalTiles: tilesX * tilesY,
    resolution: metersPerPixel(centerLat, chosenZoom).toFixed(2)
  };
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

      const center = map.getCamera().center;
      const bounds = getShapeBounds(activeShape);
      const estimate = estimateExport(bounds);
      const zoom = map.getCamera().zoom;
      const mapType = map.getStyle().style;

      exportEstimate.innerHTML = `
        <b>Export estimation</b><br>
        Zoom level: ${estimate.zoom}<br>
        Image size: ${estimate.pixelWidth} × ${estimate.pixelHeight}px<br>
        Tiles: ${estimate.tilesX} × ${estimate.tilesY}
        (${estimate.totalTiles})<br>
        Resolution: ~${estimate.resolution} m / pixel
      `;

      progressBar.style.width = "0%";
      progressText.textContent = "";

      exportModal.style.display = "flex";

      startExportBtn.onclick = () => {
        startMockProgress(estimate.totalTiles);
     };

     cancelExportBtn.onclick = closeExportModal;
    }
  });
}
