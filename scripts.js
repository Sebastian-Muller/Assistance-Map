const apiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjdkNjQ1MmQwNDY5ZTRiMWZiY2JmYjgxM2I5MGU5ODU5IiwiaCI6Im11cm11cjY0In0="; // ← Reemplazá esto con tu clave

const map = L.map('map').setView([-34.6, -58.4], 10); // Vista inicial en Bs As

const auxilioIconInactivo = L.icon({
  iconUrl: 'icons/grua-gris.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
  className: 'icono-gris'
});

const auxilioIconActivo = L.icon({
  iconUrl: 'icons/grua-negra.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});


L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let routeLayer;

const auxilioIcon = L.icon({
  iconUrl: 'icons/grua.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

function distanciaMinimaAlRecorrido(coordAuxilio, puntosRuta) {
  let min = Infinity;
  for (let i = 0; i < puntosRuta.length; i++) {
    const d = calcularDistancia(coordAuxilio, puntosRuta[i]);
    if (d < min) min = d;
  }
  return min;
}

async function trazarRuta() {
  const origen = document.getElementById("origen").value;
  const destino = document.getElementById("destino").value;

  const coordsOrigen = await geocode(origen);
  const coordsDestino = await geocode(destino);

  if (!coordsOrigen || !coordsDestino) {
    alert("No se pudo obtener coordenadas.");
    return;
  }

  const bodyRequest = {
    coordinates: [coordsOrigen, coordsDestino]
  };

  const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bodyRequest)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Error en la respuesta de la API:", errorText);
    alert(`Error en la solicitud: ${response.status} - ${errorText}`);
    return;
  }

  const data = await response.json();

  if (routeLayer) {
    map.removeLayer(routeLayer);
  }

  routeLayer = L.geoJSON(data).addTo(map);
  map.fitBounds(routeLayer.getBounds());

  const puntosRuta = extraerPuntosRuta(data, 10); // puntos cada 10 km aprox
  mostrarAuxilios(coordsOrigen, coordsDestino, puntosRuta);
}

async function geocode(lugar) {
  const res = await fetch(`https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(lugar)}`);
  const data = await res.json();
  if (data.features && data.features.length > 0) {
    return data.features[0].geometry.coordinates;
  }
  return null;
}

let auxiliosMarkers = [];

let todosLosAuxilios = []; // guardamos todos los auxilios del país

function mostrarTodosLosAuxilios() {
  fetch("auxiliosDB.json")
    .then(res => res.json())
    .then(auxilios => {
      todosLosAuxilios = auxilios;

      auxilios.forEach(aux => {
        const marker = L.marker([aux.coord[1], aux.coord[0]], {
          icon: auxilioIconInactivo
        })
          .addTo(map)
          .bindPopup(`<strong>${aux.nombre}</strong><br>${aux.localidad}`);
        
        auxiliosMarkers.push(marker);
      });
    });
}

function mostrarAuxilios(origenCoord, destinoCoord, puntosRuta) {
  const lista = document.getElementById("auxilios");
  lista.innerHTML = "";

  auxiliosMarkers.forEach((marker, i) => {
    const aux = todosLosAuxilios[i];
    const distancia = distanciaMinimaAlRecorrido(aux.coord, [origenCoord, destinoCoord, ...puntosRuta]);

    if (distancia <= 80) {
      marker.setIcon(auxilioIconActivo);

      const div = document.createElement("div");
      div.className = "auxilio";
      div.textContent = `${aux.nombre} - ${aux.localidad} - ${distancia.toFixed(2)} km`;
      lista.appendChild(div);
    } else {
      marker.setIcon(auxilioIconInactivo);
    }
  });
}


function calcularDistancia(coord1, coord2) {
  const R = 6371;
  const toRad = deg => deg * Math.PI / 180;
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function extraerPuntosRuta(data, cadaCuantosKm = 10) {
  const puntos = data.features[0].geometry.coordinates;
  const puntosFiltrados = [];

  let acumulado = 0;
  for (let i = 1; i < puntos.length; i++) {
    const anterior = puntos[i - 1];
    const actual = puntos[i];
    const dist = calcularDistancia(anterior, actual);
    acumulado += dist;

    if (acumulado >= cadaCuantosKm) {
      puntosFiltrados.push(actual);
      acumulado = 0;
    }
  }

  return puntosFiltrados;
}

// Autocompletado
const origenInput = document.getElementById('origen');
const destinoInput = document.getElementById('destino');

function crearListaSugerencias(input) {
  let container = document.createElement('div');
  container.className = 'suggestions';
  container.style.position = 'absolute';
  container.style.backgroundColor = '#fff';
  container.style.border = '1px solid #ccc';
  container.style.zIndex = '1000';
  container.style.width = input.offsetWidth + 'px';
  container.style.maxHeight = '150px';
  container.style.overflowY = 'auto';
  input.parentNode.appendChild(container);
  return container;
}

const origenSuggestions = crearListaSugerencias(origenInput);
const destinoSuggestions = crearListaSugerencias(destinoInput);

async function fetchSuggestions(text, container, input) {
  if (text.length < 3) {
    container.innerHTML = '';
    return;
  }

  const res = await fetch(`https://api.openrouteservice.org/geocode/autocomplete?api_key=${apiKey}&text=${encodeURIComponent(text)}`);
  const data = await res.json();

  container.innerHTML = '';

  if (data.features && data.features.length > 0) {
    data.features.forEach(feature => {
      const item = document.createElement('div');
      item.style.padding = '5px';
      item.style.cursor = 'pointer';
      item.textContent = feature.properties.label;

      item.addEventListener('click', () => {
        input.value = feature.properties.label;
        container.innerHTML = '';
      });

      container.appendChild(item);
    });
  }
}

origenInput.addEventListener('input', () => fetchSuggestions(origenInput.value, origenSuggestions, origenInput));
destinoInput.addEventListener('input', () => fetchSuggestions(destinoInput.value, destinoSuggestions, destinoInput));

document.addEventListener('click', e => {
  if (!origenInput.contains(e.target)) origenSuggestions.innerHTML = '';
  if (!destinoInput.contains(e.target)) destinoSuggestions.innerHTML = '';
});

mostrarTodosLosAuxilios();


