mapboxgl.accessToken = 'pk.eyJ1Ijoic2IxMDI2NiIsImEiOiJjbW9tNDI3bngwcGl1MnFwcXk5b2t0ZXNxIn0.wAwvLXMujAK956EnrX5k1A';

// Same initial Javascript as my class four project

// Used AI to help adjust the zoom features so that you can't zoom out too far since it's just a map of Philly

// Welcome modal handler
function closeWelcomeModal() {
  const modal = document.getElementById('welcome-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('welcome-modal');
  const closeBtn = document.querySelector('.modal-close');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeWelcomeModal);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeWelcomeModal();
      }
    });
  }
});

const map = new mapboxgl.Map({
  container: 'map-container',
  style: 'mapbox://styles/mapbox/light-v11',
  projection: 'mercator',
  zoom: 10.64,
  center: [-75.16071, 39.98169],
  minZoom: 9.1,
  maxZoom: 15,
  maxBounds: [
    [-75.50, 39.60],
    [-74.70, 40.45]
  ]
});

// I actually ended up changing one key thing from my class 4 project to this, which is I shifted from dark mode to light mode. I felt like light mode would make it easier to read and the colors that I picked looked better against it

map.addControl(new mapboxgl.NavigationControl());

let selectedNeighborhood = null;
let selectedRegion = null;
let activePopup = null;
let closingPopupManually = false;

map.on('load', () => {
  let neighborhoodsInfo = {};

  Promise.all([
    fetch('philadelphia-neighborhoods.geojson').then(res => res.json()),
    fetch('neighborhoods-info.json').then(res => res.json())
  ])
    .then(([data, infoData]) => {
      neighborhoodsInfo = infoData.neighborhoods;

      const regionColors = {
        northwest: '#7fc97f',
        north: '#beaed4',
        northeast: '#fdc086',
        south: '#ffff99',
        east: '#386cb0',
        west: '#f0027f',
        central: '#bf5b17'
      };

// I used the resource you shared with me from my class 4 assignment to pick distinct colors for each region. After I picked these colors I made the shift from dark mode to light mode, you'll see that comment elsewhere as well.

// I also added in summaries for the regions, which was pulled through a mix of me googling and putting in info and the AI automatically finishing the sentences for me. I wanted to add in the region descriptions to give users a better sense of the overall character of each region, and to make it more likely that they would want to click on the individual neighborhoods within each region to learn more about them.
      const regionDescriptions = infoData.regionDescriptions || {};

      const center = [-75.1652, 39.9526];

      function getCentroid(geometry) {
        let x = 0, y = 0, count = 0;

        const addCoord = (coord) => {
          if (!Array.isArray(coord) || coord.length < 2) return;
          x += coord[0];
          y += coord[1];
          count += 1;
        };

        if (geometry.type === 'Polygon') {
          geometry.coordinates.forEach(ring => {
            ring.forEach(addCoord);
          });
        } else if (geometry.type === 'MultiPolygon') {
          geometry.coordinates.forEach(polygon => {
            polygon.forEach(ring => {
              ring.forEach(addCoord);
            });
          });
        }

        return count ? [x / count, y / count] : [0, 0];
      }

      function getFeatureBounds(feature) {
        const bounds = [Infinity, Infinity, -Infinity, -Infinity];
        const extend = (coord) => {
          bounds[0] = Math.min(bounds[0], coord[0]);
          bounds[1] = Math.min(bounds[1], coord[1]);
          bounds[2] = Math.max(bounds[2], coord[0]);
          bounds[3] = Math.max(bounds[3], coord[1]);
        };

        if (feature.geometry.type === 'Polygon') {
          feature.geometry.coordinates.forEach(ring => ring.forEach(extend));
        } else if (feature.geometry.type === 'MultiPolygon') {
          feature.geometry.coordinates.forEach(polygon => polygon.forEach(ring => ring.forEach(extend)));
        }

        return bounds;
      }

      function getBoundsFromFeatures(features) {
        if (!features.length) return null;

        const bounds = [Infinity, Infinity, -Infinity, -Infinity];
        features.forEach(feature => {
          const featureBounds = getFeatureBounds(feature);
          bounds[0] = Math.min(bounds[0], featureBounds[0]);
          bounds[1] = Math.min(bounds[1], featureBounds[1]);
          bounds[2] = Math.max(bounds[2], featureBounds[2]);
          bounds[3] = Math.max(bounds[3], featureBounds[3]);
        });

        return [[bounds[0], bounds[1]], [bounds[2], bounds[3]]];
      }

      function renderRegionNeighborhoodList(region) {
        selectedRegion = region;
        const listContainer = document.getElementById('neighborhood-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        listContainer.classList.add('active');

        const descriptionText = regionDescriptions[region] || 'No description available yet for this region.';
        const regionHeader = document.createElement('div');
        regionHeader.className = 'region-popup-header';
        regionHeader.innerHTML = `<h3>${region.charAt(0).toUpperCase() + region.slice(1)} Region</h3>`;
        const descriptionEl = document.createElement('p');
        descriptionEl.className = 'region-description';
        descriptionEl.innerText = descriptionText;

        listContainer.appendChild(regionHeader);
        listContainer.appendChild(descriptionEl);

        const neighborhoods = data.features
          .filter(f => f.properties.region === region)
          .map(f => f.properties.LISTNAME)
          .sort();

        neighborhoods.forEach(name => {
          const item = document.createElement('div');
          item.className = 'legend-item';
          item.innerText = name;

          item.addEventListener('click', (e) => {
            e.stopPropagation();

            // Toggle OFF neighborhood
            if (selectedNeighborhood === name && selectedRegion === region) {
              resetMap();
              return;
            }

            selectedNeighborhood = name;
            selectedRegion = region;

            const feature = data.features.find(f => f.properties.LISTNAME === name);
            if (feature) {
              const [lng, lat] = getCentroid(feature.geometry);
              map.flyTo({ center: [lng, lat], zoom: 13, speed: 1.2 });

              removeActivePopupSafely();
              showNeighborhoodPopup(feature, [lng, lat]);
            }

            map.setFilter('neighborhoods-highlight', ['==', 'LISTNAME', name]);

            map.setPaintProperty('neighborhoods-fill', 'fill-opacity', [
              'case',
              ['==', ['get', 'LISTNAME'], name],
              1,
              0.2
            ]);
          });

          listContainer.appendChild(item);
        });
      }

      function showNeighborhoodPopup(feature, lngLat) {
        const name = feature.properties.LISTNAME;
        const region = feature.properties.region;

        const areaSqKm = (feature.properties.Shape_Area / 1000000).toFixed(2);
        const areaSqMiles = (feature.properties.Shape_Area * 0.000000386102).toFixed(2);
        const description = neighborhoodsInfo[name] || 'No description available for this neighborhood.';

        const popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false,
          offset: [0, -20]
        })
          .setLngLat(lngLat)
          .setHTML(
            `<strong>${name}</strong>` +
            `<p><em>${region}</em> Region | Area: ${areaSqKm} km² (${areaSqMiles} mi²)</p>` +
            `<p>${description}</p>`
          )
          .addTo(map);

        popup.on('close', () => {
          activePopup = null;
          if (!closingPopupManually) {
            resetMap(true);
          }
          closingPopupManually = false;
        });

        removeActivePopupSafely();

        activePopup = popup;
      }

      function removeActivePopupSafely() {
        if (activePopup) {
          closingPopupManually = true;
          activePopup.remove();
          activePopup = null;
        }
      }

      function resetMap(fromPopupClose = false) {
        selectedNeighborhood = null;
        selectedRegion = null;

        if (!fromPopupClose) {
          removeActivePopupSafely();
        }

        map.setFilter('neighborhoods-fill', null);
        map.setFilter('neighborhoods-highlight', ['==', 'LISTNAME', '']);

        map.setPaintProperty('neighborhoods-fill', 'fill-opacity', 0.7);

        const initialBounds = [
          [-75.28026418506731, 39.8670057574966],
          [-74.95576188422399, 40.137992794380835]
        ];
        map.fitBounds(initialBounds, { padding: 40, duration: 1200 });

        const listContainer = document.getElementById('neighborhood-list');
        if (listContainer) {
          listContainer.innerHTML = '';
          listContainer.classList.remove('active');
        }
      }

      data.features.forEach(feature => {
        const [lng, lat] = getCentroid(feature.geometry);

        const latDiff = lat - center[1];
        const lngDiff = lng - center[0];

        let region;

        if (latDiff > 0.02) {
          if (lngDiff < -0.02) region = 'northwest';
          else if (lngDiff > 0.02) region = 'northeast';
          else region = 'north';
        } else if (latDiff < -0.02) {
          region = 'south';
        } else if (lngDiff > 0.02) {
          region = 'east';
        } else if (lngDiff < -0.02) {
          region = 'west';
        } else {
          region = 'central';
        }

        const northwestForcedNames = new Set([
          'Cedarbrook',
          'Mount Airy, East',
          'West Oak Lane',
          'Wister'
        ]);

        if (feature.properties.LISTNAME.includes('Germantown') || northwestForcedNames.has(feature.properties.LISTNAME)) {
          region = 'northwest';
        }

        feature.properties.region = region;
        feature.properties.color = regionColors[region];
      });

      map.addSource('neighborhoods', {
        type: 'geojson',
        data: data
      });

      map.addLayer({
        id: 'neighborhoods-fill',
        type: 'fill',
        source: 'neighborhoods',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.7
        }
      });

      map.addLayer({
        id: 'neighborhoods-outline',
        type: 'line',
        source: 'neighborhoods',
        paint: {
          'line-color': '#000000',
          'line-width': 1
        }
      });

      map.addLayer({
        id: 'neighborhoods-label',
        type: 'symbol',
        source: 'neighborhoods',
        layout: {
          'text-field': ['get', 'LISTNAME'],
          'text-font': ['Open Sans SemiBold', 'Arial Unicode MS Bold'],
          'text-size': 12,
          'text-anchor': 'center',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'symbol-placement': 'point'
        },
        paint: {
          'text-color': '#000000',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1
        }
      });

      map.addLayer({
        id: 'neighborhoods-highlight',
        type: 'line',
        source: 'neighborhoods',
        paint: {
          'line-color': '#ffffff',
          'line-width': 4
        },
        filter: ['==', 'LISTNAME', '']
      });

      const initialBounds = [
        [-75.28026418506731, 39.8670057574966],
        [-74.95576188422399, 40.137992794380835]
      ];

      // Fit the entire Philadelphia area in the viewport
      map.fitBounds(initialBounds, { padding: 40 });

      // LEGEND INTERACTIVITY
      Object.keys(regionColors).forEach(region => {
        const el = document.getElementById(`legend-${region}`);
        if (!el) return;

        el.addEventListener('click', (e) => {
          e.stopPropagation();

          // Toggle OFF
          if (selectedRegion === region) {
            resetMap();
            return;
          }

          removeActivePopupSafely();

          selectedRegion = region;
          selectedNeighborhood = null;

          map.setFilter('neighborhoods-fill', ['==', ['get', 'region'], region]);

          const regionFeatures = data.features.filter(f => f.properties.region === region);
          const regionBounds = getBoundsFromFeatures(regionFeatures);
          if (regionBounds) {
            map.fitBounds(regionBounds, { padding: 80, duration: 1200 });
          }

          renderRegionNeighborhoodList(region);

        });
      });

      // ✅ Map click handler (neighborhoods and background)
      // This gave me soooooooo much trouble, both asking AI for help and trying to figure it out myself. But I finally got it working!
      map.on('click', (e) => {
        // Close any active popup first
        removeActivePopupSafely();

        const features = map.queryRenderedFeatures(e.point, {
          layers: ['neighborhoods-fill']
        });

        if (features.length) {
          // Neighborhood click
          const feature = features[0];
          const name = feature.properties.LISTNAME;
          const region = feature.properties.region;

          if (selectedNeighborhood === name) {
            resetMap();
            return;
          }

          selectedNeighborhood = name;
          selectedRegion = region;

          const [lng, lat] = getCentroid(feature.geometry);
          map.flyTo({ center: [lng, lat], zoom: 13, speed: 1.2 });

          map.setFilter('neighborhoods-fill', null);
          map.setFilter('neighborhoods-highlight', ['==', 'LISTNAME', name]);

          map.setPaintProperty('neighborhoods-fill', 'fill-opacity', [
            'case',
            ['==', ['get', 'LISTNAME'], name],
            1,
            0.2
          ]);

          renderRegionNeighborhoodList(region);
          showNeighborhoodPopup(feature, e.lngLat);
        } else {
          // Background click reset
          resetMap();
        }
      });

      const resetButton = document.getElementById('map-reset-button');
      if (resetButton) {
        resetButton.addEventListener('click', (e) => {
          e.stopPropagation();
          resetMap();
        });
      }

      map.on('mouseenter', 'neighborhoods-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'neighborhoods-fill', () => {
        map.getCanvas().style.cursor = '';
      });

    });

});