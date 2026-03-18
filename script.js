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
let searchMarker = null;
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
    
    // Add scale bar control
    map.controls.add(new atlas.control.ScaleControl({
      maxBarLength: 100,
      units: 'metric'
    }), {
      position: 'bottom-left'
    });
    
    // Initialize drawing manager WITHOUT toolbar
    drawingManager = new atlas.drawing.DrawingManager(map, {
      toolbar: new atlas.control.DrawingToolbar({
        buttons: [],
        position: 'top-right',
        style: 'light',
        visible: false
      }),
      freehandInterval: 3,
      snapDistance: 15,
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
    
    // Initialize all controls after map is ready
    initializeMapControls();
  });
  
  map.events.add('error', function(e) {
    console.error('Map error:', e);
  });
}

// Initialize all map controls
function initializeMapControls() {
  initSearchBar();
  initNavigationControls();
  initStyleToggle();
  initLabelToggle();
}

// Search functionality
function initSearchBar() {
  const searchInput = document.getElementById('mapSearchInput');
  const searchResults = document.getElementById('searchResults');
  
  if (!searchInput || !searchResults) return;
  
  let searchTimeout;
  
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length < 3) {
      searchResults.style.display = 'none';
      return;
    }
    
    searchTimeout = setTimeout(() => searchLocation(query), 500);
  });
  
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.style.display = 'none';
    }
  });
}

async function searchLocation(query) {
  const searchResults = document.getElementById('searchResults');
  
  try {
    const url = `https://atlas.microsoft.com/search/fuzzy/json?` +
      `api-version=1.0` +
      `&query=${encodeURIComponent(query)}` +
      `&subscription-key=${window.azureMapsSubscriptionKey}` +
      `&limit=5`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      displaySearchResults(data.results);
    } else {
      searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
      searchResults.style.display = 'block';
    }
  } catch (error) {
    console.error('Search error:', error);
    searchResults.innerHTML = '<div class="search-result-item">Search failed</div>';
    searchResults.style.display = 'block';
  }
}

function displaySearchResults(results) {
  const searchResults = document.getElementById('searchResults');
  searchResults.innerHTML = '';
  
  results.forEach(result => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.innerHTML = `
      <div style="font-weight: 600;">${result.poi?.name || result.address.freeformAddress}</div>
      <div style="font-size: 11px; color: #666; margin-top: 2px;">${result.address.countrySubdivision || ''} ${result.address.country || ''}</div>
    `;
    
    item.onclick = () => {
      goToLocation(result.position.lat, result.position.lon, result.poi?.name || result.address.freeformAddress);
      searchResults.style.display = 'none';
      document.getElementById('mapSearchInput').value = result.address.freeformAddress;
    };
    
    searchResults.appendChild(item);
  });
  
  searchResults.style.display = 'block';
}

function goToLocation(lat, lng, name) {
  if (searchMarker) {
    map.markers.remove(searchMarker);
  }
  
  searchMarker = new atlas.HtmlMarker({
    position: [lng, lat],
    htmlContent: `
      <div style="
        background: #d32f2f;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 12px;
        box-shadow: 0 3px 8px rgba(0,0,0,0.3);
        white-space: nowrap;
      ">
        📍 ${name}
      </div>
    `,
    pixelOffset: [0, -10]
  });
  
  map.markers.add(searchMarker);
  
  map.setCamera({
    center: [lng, lat],
    zoom: 15,
    type: 'fly',
    duration: 1000
  });
}

// Navigation Controls
function initNavigationControls() {
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  const rotateLeftBtn = document.getElementById('rotateLeft');
  const rotateRightBtn = document.getElementById('rotateRight');
  const resetNorthBtn = document.getElementById('resetNorth');

  if (zoomInBtn) {
    zoomInBtn.onclick = () => {
      const currentZoom = map.getCamera().zoom;
      map.setCamera({ zoom: currentZoom + 1, type: 'ease', duration: 300 });
    };
  }

  if (zoomOutBtn) {
    zoomOutBtn.onclick = () => {
      const currentZoom = map.getCamera().zoom;
      map.setCamera({ zoom: currentZoom - 1, type: 'ease', duration: 300 });
    };
  }

  if (rotateLeftBtn) {
    rotateLeftBtn.onclick = () => {
      const currentBearing = map.getCamera().bearing || 0;
      map.setCamera({ bearing: currentBearing - 15, type: 'ease', duration: 300 });
    };
  }

  if (rotateRightBtn) {
    rotateRightBtn.onclick = () => {
      const currentBearing = map.getCamera().bearing || 0;
      map.setCamera({ bearing: currentBearing + 15, type: 'ease', duration: 300 });
    };
  }

  if (resetNorthBtn) {
    resetNorthBtn.onclick = () => {
      map.setCamera({ 
        bearing: 0, 
        pitch: 0,
        type: 'ease', 
        duration: 500 
      });
    };
  }
}

// Style Toggle - FIXED VERSION
let currentStyle = 'road';
let labelsVisible = true;
let isChangingStyle = false;

function initStyleToggle() {
  const toggleStyleBtn = document.getElementById('toggleStyle');
  
  if (!toggleStyleBtn) return;
  
  toggleStyleBtn.style.minWidth = '100px';
  toggleStyleBtn.style.fontSize = '11px';
  toggleStyleBtn.style.padding = '6px 10px';
  
  toggleStyleBtn.onclick = () => {
    if (!map || isChangingStyle) return;
    
    isChangingStyle = true;
    toggleStyleBtn.disabled = true;
    
    // Determine new style
    let newStyleName;
    
    if (currentStyle === 'road') {
      // Switching TO satellite
      newStyleName = labelsVisible ? 'satellite_road_labels' : 'satellite';
      currentStyle = 'satellite';
      toggleStyleBtn.textContent = '🗺️ Road';
      toggleStyleBtn.style.background = '#2e7d32';
    } else {
      // Switching TO road
      newStyleName = labelsVisible ? 'road' : 'road_shaded_relief';
      currentStyle = 'road';
      toggleStyleBtn.textContent = '🛰️ Satellite';
      toggleStyleBtn.style.background = '#007bff';
    }
    
    console.log('Switching to style:', newStyleName);
    
    // Apply the style change
    map.setStyle({
      style: newStyleName
    });
    
    // Re-enable button after transition
    setTimeout(() => {
      isChangingStyle = false;
      toggleStyleBtn.disabled = false;
    }, 1500);
  };
}

// Label Toggle
function initLabelToggle() {
  const toggleLabelsBtn = document.getElementById('toggleLabels');
  
  if (!toggleLabelsBtn) return;
  
  toggleLabelsBtn.onclick = () => {
    if (isChangingStyle) return;
    
    isChangingStyle = true;
    toggleLabelsBtn.disabled = true;
    
    labelsVisible = !labelsVisible;
    
    let newStyleName;
    
    if (labelsVisible) {
      toggleLabelsBtn.textContent = '🏷️ Hide Labels';
      newStyleName = currentStyle === 'satellite' ? 'satellite_road_labels' : 'road';
    } else {
      toggleLabelsBtn.textContent = '🏷️ Show Labels';
      newStyleName = currentStyle === 'satellite' ? 'satellite' : 'road_shaded_relief';
    }
    
    console.log('Switching labels to style:', newStyleName);
    
    map.setStyle({
      style: newStyleName
    });
    
    setTimeout(() => {
      isChangingStyle = false;
      toggleLabelsBtn.disabled = false;
    }, 1500);
  };
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

// Display area label inside the shape
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
    const areaSqFt = (area * 10.7639).toFixed(2);
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

// Update distance line with markers and labels
function updateDistanceLine() {
  if (!distanceDataSource || distancePath.length === 0) return;
  
  distanceMarkers.forEach(marker => map.markers.remove(marker));
  distanceMarkers = [];
  
  distanceDataSource.clear();
  
  const line = new atlas.data.LineString(distancePath);
  distanceDataSource.add(new atlas.data.Feature(line));
  
  let totalDistance = 0;
  
  for (let i = 0; i < distancePath.length; i++) {
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
    
    if (i > 0) {
      const pos1 = new atlas.data.Position(distancePath[i-1][0], distancePath[i-1][1]);
      const pos2 = new atlas.data.Position(distancePath[i][0], distancePath[i][1]);
      const segmentDistance = atlas.math.getDistanceTo(pos1, pos2);
      totalDistance += segmentDistance;
      
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

// Clear all shapes function
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
  
  if (searchMarker) {
    map.markers.remove(searchMarker);
    searchMarker = null;
  }
}

const clearShapeBtn = document.getElementById("clearShape");
if (clearShapeBtn) {
  clearShapeBtn.onclick = clearAllShapes;
}

// Context menu handlers
if (contextMenu) {
  contextMenu.addEventListener("click", e => {
    const action = e.target.dataset.action;
    contextMenu.style.display = "none";

    if (!action || !contextLatLng) return;

    const lng = contextLatLng[0];
    const lat = contextLatLng[1];

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
