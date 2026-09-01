// src/components/map/utils/leafletHtml.ts
import { TILE_ATTRIBUTION, TILE_MAX_ZOOM, TILE_URL } from './tiles';
export function buildLeafletHtml(): string {
    return `
  <!doctype html>
  <html>
  <head>
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
    />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map {
        height: 100%;
        margin: 0;
        padding: 0;
        background: #ffffff;
      }
      body { overflow: hidden; }
      .leaflet-container { width: 100%; height: 100%; background: #f5f5f5; }
      .motorista-icon { background: transparent; border: none; }
      .onibus-icon { background: transparent; border: none; }
      .parada-icon { background: transparent; border: none; }
  
      #error-msg {
        display: none;
        position: absolute;
        inset: 0;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        background: #f5f5f5;
        font-family: sans-serif;
        color: #64748B;
        font-size: 14px;
        text-align: center;
        padding: 16px;
      }
      #error-msg.visible { display: flex; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <div id="error-msg">
      <span style="font-size:32px">🗺️</span>
      <p style="margin:8px 0 4px">Mapa indisponível</p>
      <small>Verifique sua conexão com a internet</small>
    </div>
  
    <script>
      function postMessage(payload) {
        try {
          window.ReactNativeWebView &&
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        } catch (e) {}
      }
  
      function showError() {
        document.getElementById('map').style.display = 'none';
        document.getElementById('error-msg').classList.add('visible');
        postMessage({ type: 'mapError' });
      }
  
      var loadTimeout = setTimeout(function() {
        if (typeof L === 'undefined') showError();
      }, 8000);
    </script>
  
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      onerror="clearTimeout(loadTimeout); showError();"
    ></script>
  
    <script>
      (function () {
        if (typeof L === 'undefined') return;
        clearTimeout(loadTimeout);
  
        function escaparHtml(texto) {
          return String(texto).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
          });
        }

        const BuskaMap = {
          mapInstance: null,
          userMarker: null,
          destMarker: null,
          routeLine: null,
          stopMarkers: [],
          enquadrou: false,
  
          init() {
            if (this.mapInstance) return;
  
            this.mapInstance = L.map('map', {
              zoomControl: false,
              preferCanvas: false,
            }).setView([-23.55, -46.63], 13);

            L.control.zoom({ position: 'topright' }).addTo(this.mapInstance);
  
            L.tileLayer('${TILE_URL}', {
              attribution: '${TILE_ATTRIBUTION}',
              maxZoom: ${TILE_MAX_ZOOM},
            }).addTo(this.mapInstance);
  
            postMessage({ type: 'mapReady' });
          },
  
          setDestination(lat, lng) {
            if (!this.mapInstance) return;
            const latLng = L.latLng(lat, lng);
  
            if (this.destMarker) {
              this.destMarker.setLatLng(latLng);
            } else {
              const icon = L.divIcon({
                className: 'onibus-icon',
                html: '<div style="font-size:26px;line-height:32px;text-align:center;">&#128652;</div>',
                iconSize: [32, 32],
                iconAnchor: [16, 16],
              });
              this.destMarker = L.marker(latLng, { icon }).addTo(this.mapInstance);
            }

            this.mapInstance.setView(latLng, this.mapInstance.getZoom());
          },
  
          clearDestination() {
            if (this.mapInstance && this.destMarker) {
              this.mapInstance.removeLayer(this.destMarker);
              this.destMarker = null;
            }
          },
  
          setUserMarker(lat, lng) {
            if (!this.mapInstance) return;
            const latLng = L.latLng(lat, lng);
  
            if (this.userMarker) {
              this.userMarker.setLatLng(latLng);
              return;
            }
  
            const icon = L.divIcon({
              className: 'motorista-icon',
              html: '<div style="width:16px;height:16px;background:#2196F3;border:3px solid white;border-radius:50%;box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>',
            });
  
            this.userMarker = L.marker(latLng, {
              icon,
              zIndexOffset: 1000,
            }).addTo(this.mapInstance);
          },
  
          clearUserMarker() {
            if (this.mapInstance && this.userMarker) {
              this.mapInstance.removeLayer(this.userMarker);
              this.userMarker = null;
            }
          },
  
          setStops(paradas, proximaId) {
            if (!this.mapInstance) return;

            (this.stopMarkers || []).forEach(function (m) {
              BuskaMap.mapInstance.removeLayer(m);
            });
            this.stopMarkers = [];

            if (!Array.isArray(paradas) || !paradas.length) return;

            paradas.forEach(function (parada, i) {
              var cor = parada.id === proximaId ? '#1565C0' : '#90A4AE';
              var icon = L.divIcon({
                className: 'parada-icon',
                html:
                  '<div style="width:22px;height:22px;border-radius:50%;display:flex;' +
                  'align-items:center;justify-content:center;font:700 12px sans-serif;' +
                  'border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4);background:' +
                  cor + ';color:#fff;">' + (i + 1) + '</div>',
                iconSize: [22, 22],
                iconAnchor: [11, 11],
              });
              var marcador = L.marker([parada.latitude, parada.longitude], { icon })
                .addTo(BuskaMap.mapInstance);
              // Popup em vez de tooltip: tooltip depende de passar o mouse, que
              // não existe em tela de toque.
              marcador.bindPopup(
                '<b>' + (i + 1) + '.</b> ' + escaparHtml(parada.apelido || 'Parada ' + (i + 1)),
                { closeButton: false, offset: [0, -6] }
              );
              BuskaMap.stopMarkers.push(marcador);
            });

            // Na primeira vez enquadra a rota inteira. Sem isso o mapa abre no
            // zoom 13, que mostra 7 km, e uma rota de 600 m vira um borrão.
            if (!this.enquadrou && paradas.length > 1) {
              this.mapInstance.fitBounds(
                paradas.map(function (p) { return [p.latitude, p.longitude]; }),
                { padding: [40, 40] }
              );
              this.enquadrou = true;
            }
          },

          setMargins(topo, base) {
            // O Leaflet cria uma faixa por canto: .leaflet-top vem em left e
            // right, e .leaflet-bottom também. Mexer só na primeira deixa a
            // atribuição escondida atrás do painel.
            var ajustar = function (seletor, prop, valor) {
              var faixas = document.querySelectorAll(seletor);
              for (var i = 0; i < faixas.length; i++) faixas[i].style[prop] = valor + 'px';
            };
            ajustar('.leaflet-top', 'marginTop', topo + 8);
            ajustar('.leaflet-bottom', 'marginBottom', base + 4);
          },

          setRoute(coords) {
            if (!this.mapInstance) return;
  
            if (this.routeLine) {
              this.mapInstance.removeLayer(this.routeLine);
              this.routeLine = null;
            }
  
            if (!Array.isArray(coords) || coords.length < 2) return;
  
            const latLngs = coords.map(function (coord) {
              return [coord.latitude, coord.longitude];
            });
  
            this.routeLine = L.polyline(latLngs, {
              color: '#007bff',
              weight: 6,
              opacity: 0.8,
            }).addTo(this.mapInstance);
          },
  
          clearRoute() {
            if (this.mapInstance && this.routeLine) {
              this.mapInstance.removeLayer(this.routeLine);
              this.routeLine = null;
            }
          },
  
          fitToCoordinates(coords) {
            if (!this.mapInstance || !Array.isArray(coords) || coords.length < 2) return;
  
            const latLngs = coords.map(function (coord) {
              return [coord.latitude, coord.longitude];
            });
  
            this.mapInstance.fitBounds(latLngs, { padding: [30, 30] });
          },
        };
  
        window.BuskaMap = BuskaMap;
  
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                BuskaMap.init();
            });
        } else {
            BuskaMap.init();
        }
      })();
    </script>
  </body>
  </html>
    `;
  }