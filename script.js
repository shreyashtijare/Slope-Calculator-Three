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

/* =========================================================
   GLOBAL STATE
========================================================= */
let map;
let drawingManager;
let activeShape = null;

let contextLatLng = null;
let measuringDistance = false;
let distancePath = [];
let distanceLine = null;

let mockProgressTimer = null;

/* =========================================================
   DOM REFERENCES
========================================================= */
// Sidebar
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");

// Panels
const panels = document.querySelectorAll(".panel");

// Context menu + info
const contextMenu = document.getElementById("contextMenu");
const infoPanel = document.getElementById("infoPanel");

// Export modal
const exportModal = document.getElementById("exportModal");
const exportEstimate = document.getElementById("exportEstimate");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const startExportBtn = document.getElementById("startExportBtn");
const cancelExportBtn = document.getElementById("cancelExportBtn");

/* =========================================================
   SIDEBAR & PANEL NAVIGATION
========================================================= */
sidebarToggle.onclick = () => {
  sidebar.classList.toggle("open");
};

document.querySelectorAll(".sidebar a").forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    sidebar.classList.remove("open");

    panels.forEach(p => p.classList.remove("active"));
    const target = document.getElementById(link.dataset.panel);
    target.classList.add("active");

    if (link.dataset.panel === "mapPanel" && map) {
      setTimeout(() => {
        google.maps.event.trigger(map, "resize");
        map.setCenter(map.getCenter());
      }, 100);
    }
  });
});

/* =========================================================
   SLOPE CALCULATOR
========================================================= */
const he = document.getElementById("he");
const le = document.getElementById("le");
const distance = document.getElementById("distance");
const slope = document.getElementById("slope");
const result = document.getElementById("result");

document.getElementById("calculateBtn").onclick = () => {
  const HE = parseFloat(he.value);
  const LE = parseFloat(le.value);
  const D = parseFloat(distance.value);
  const S = parseFloat(slope.value);

  if ([HE, LE, D, S].filter(v => !isNaN(v)).length < 3) {
    result.textContent = "⚠️ Enter any 3 values.";
    return;
  }

  // ((HE - LE) / Distance) * 100 = Slope %
  if (isNaN(S)) {
    slope.value = (((HE - LE) / D) * 100).toFixed(3);
    result.textContent = "Slope calculated.";
  } else if (isNaN(D)) {
    distance.value = ((HE - LE) / (S / 100)).toFixed(3);
    result.textContent = "Distance calculated.";
  } else if (isNaN(HE)) {
    he.value = (LE + D * (S / 100)).toFixed(3);
    result.textContent = "Higher elevation calculated.";
  } else if (isNaN(LE)) {
    le.value = (HE - D * (S / 100)).toFixed(3);
    result.textContent = "Lower elevation calculated.";
  }
};

document.getElementById("resetBtn").onclick = () => {
  he.value = le.value = distance.value = slope.value = "";
  result.textContent = "";
};

/* =========================================================
   SLOPE CONVERSION
========================================================= */
document.getElementById("convertBtn").onclick = () => {
  const p = parseFloat(convPercent.value);
  const r = parseFloat(ratioRise.value);
  const run = parseFloat(ratioRun.value);
  const a = parseFloat(convAngle.value);
  const out = document.getElementById("convResult");

  if (!isNaN(p)) {
    const angle = Math.atan(p / 100) * 180 / Math.PI;
    out.innerHTML = `
      ${p}%<br>
      Ratio: 1:${(100 / p).toFixed(3)}<br>
      Angle: ${angle.toFixed(3)}°
    `;
    return;
  }

  if (!isNaN(r) && !isNaN(run)) {
    const percent = (r / run) * 100;
    const angle = Math.atan(r / run) * 180 / Math.PI;
    out.innerHTML = `
      ${r}:${run}<br>
      Percent: ${percent.toFixed(3)}%<br>
      Angle: ${angle.toFixed(3)}°
    `;
    return;
  }

  if (!isNaN(a)) {
    const percent = Math.tan(a * Math.PI / 180) * 100;
    out.innerHTML = `
      ${a}°<br>
      Percent: ${percent.toFixed(3)}%<br>
      Ratio: 1:${(100 / percent).toFixed(3)}
    `;
    return;
  }

  out.textContent = "⚠️ Enter a value to convert.";
};

/* =========================================================
   GOOGLE MAP INIT
========================================================= */
function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 20.5937, lng: 78.9629 },
    zoom: 5,
    mapTypeId: "satellite",
    gestureHandling: "greedy"
  });

  drawingManager = new google.maps.drawing.DrawingManager({
    drawingControl: true,
    drawingControlOptions: {
      drawingModes: ["polygon", "rectangle"]
    },
    polygonOptions: {
      fillColor: "#007bff",
      fillOpacity: 0.25,
      strokeColor: "#007bff",
      strokeWeight: 2,
      editable: true
    },
    rectangleOptions: {
      fillColor: "#007bff",
      fillOpacity: 0.25,
      strokeColor: "#007bff",
      strokeWeight: 2,
      editable: true
    }
  });

  drawingManager.setMap(map);

  google.maps.event.addListener(drawingManager, "overlaycomplete", e => {
    if (activeShape) activeShape.setMap(null);
    activeShape = e.overlay;
    drawingManager.setDrawingMode(null);
  });

  map.addListener("rightclick", e => {
    contextLatLng = e.latLng;
    contextMenu.style.left = e.pixel.x + "px";
    contextMenu.style.top = e.pixel.y + "px";
    contextMenu.style.display = "block";
  });

  map.addListener("click", () => {
    contextMenu.style.display = "none";
    if (measuringDistance && contextLatLng) {
      distancePath.push(contextLatLng);
      updateDistanceLine();
    }
  });
}

window.onload = initMap;

/* =========================================================
   HELPERS
========================================================= */
function showInfo(html) {
  infoPanel.innerHTML = html;
  infoPanel.style.display = "block";
}

function getShapeBounds(shape) {
  if (shape instanceof google.maps.Rectangle) return shape.getBounds();
  const bounds = new google.maps.LatLngBounds();
  shape.getPath().forEach(p => bounds.extend(p));
  return bounds;
}

function metersPerPixel(lat, zoom) {
  return 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
}

function estimateExport(bounds) {
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const centerLat = (ne.lat() + sw.lat()) / 2;

  const widthMeters = google.maps.geometry.spherical.computeDistanceBetween(
    new google.maps.LatLng(ne.lat(), sw.lng()), ne
  );
  const heightMeters = google.maps.geometry.spherical.computeDistanceBetween(
    new google.maps.LatLng(sw.lat(), ne.lng()), ne
  );

  let zoom = 21, pxW, pxH;
  while (zoom > 14) {
    const mpp = metersPerPixel(centerLat, zoom);
    pxW = widthMeters / mpp;
    pxH = heightMeters / mpp;
    if (pxW < 12000 && pxH < 12000) break;
    zoom--;
  }

  return {
    zoom,
    pixelWidth: Math.round(pxW),
    pixelHeight: Math.round(pxH),
    tilesX: Math.ceil(pxW / 1280),
    tilesY: Math.ceil(pxH / 1280),
    totalTiles: Math.ceil(pxW / 1280) * Math.ceil(pxH / 1280),
    resolution: metersPerPixel(centerLat, zoom).toFixed(2)
  };
}

/* =========================================================
   CONTEXT MENU ACTIONS
========================================================= */
contextMenu.addEventListener("click", e => {
  const action = e.target.dataset.action;
  contextMenu.style.display = "none";
  if (!action || !contextLatLng) return;

  if (action === "export") {
    if (!activeShape) {
      showInfo("⚠️ Draw an area first.");
      return;
    }

    const est = estimateExport(getShapeBounds(activeShape));
    exportEstimate.innerHTML = `
      <b>Export estimation</b><br>
      Zoom: ${est.zoom}<br>
      Image: ${est.pixelWidth} × ${est.pixelHeight}px<br>
      Tiles: ${est.tilesX} × ${est.tilesY} (${est.totalTiles})<br>
      Resolution: ~${est.resolution} m/px
    `;

    progressBar.style.width = "0%";
    progressText.textContent = "";
    exportModal.style.display = "flex";

    startExportBtn.onclick = () => startMockProgress(est.totalTiles);
    cancelExportBtn.onclick = closeExportModal;
  }
});

/* =========================================================
   EXPORT PROGRESS (MOCK)
========================================================= */
function startMockProgress(total) {
  let done = 0;
  mockProgressTimer = setInterval(() => {
    done++;
    const pct = Math.round((done / total) * 100);
    progressBar.style.width = pct + "%";
    progressText.textContent = `Rendering tile ${done} of ${total}`;
    if (done >= total) {
      clearInterval(mockProgressTimer);
      progressText.textContent = "Export ready (mock).";
    }
  }, 150);
}

function closeExportModal() {
  exportModal.style.display = "none";
  clearInterval(mockProgressTimer);
}

function updateDistanceLine() {
  if (distanceLine) distanceLine.setPath(distancePath);
}

