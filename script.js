mapboxgl.accessToken = 'pk.eyJ1Ijoic2IxMDI2NiIsImEiOiJjbW9tNDI3bngwcGl1MnFwcXk5b2t0ZXNxIn0.wAwvLXMujAK956EnrX5k1A';

// Same Initial Javascript as my class four project

// Used AI to help adjust the zoom features so that you can't zoom out too far since it's just a map of Philly

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


map.addControl(new mapboxgl.NavigationControl());

let selectedNeighborhood = null;
let selectedRegion = null;

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

      const center = [-75.1652, 39.9526];

      function getCentroid(coords) {
        let x = 0, y = 0, count = 0;
        coords.forEach(polygon => {
          polygon.forEach(ring => {
            ring.forEach(coord => {
              x += coord[0];
              y += coord[1];
              count++;
            });
          });
        });
        return [x / count, y / count];
      }

      data.features.forEach(feature => {
        const [lng, lat] = getCentroid(feature.geometry.coordinates);

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
          'text-size': 10,
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

      // Fit the entire Philadelphia area in the viewport
      map.fitBounds(
        [
          [-75.28026418506731, 39.8670057574966],
          [-74.95576188422399, 40.137992794380835]
        ],
        { padding: 40 }
      );

      // 🟡 LEGEND INTERACTIVITY
      Object.keys(regionColors).forEach(region => {
        const el = document.getElementById(`legend-${region}`);
        if (!el) return;

        el.addEventListener('click', (e) => {
          e.stopPropagation();

          // Toggle OFF
          if (selectedRegion === region) {
            selectedRegion = null;

            map.setFilter('neighborhoods-fill', null);
            map.setPaintProperty('neighborhoods-fill', 'fill-opacity', 0.7);

            const listEl = document.getElementById('neighborhood-list');
            listEl.innerHTML = '';
            listEl.classList.remove('active');
            return;
          }

          selectedRegion = region;
          selectedNeighborhood = null;

          map.setFilter('neighborhoods-fill', ['==', ['get', 'region'], region]);

          const listContainer = document.getElementById('neighborhood-list');
          listContainer.innerHTML = '';
          listContainer.classList.add('active');

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
              if (selectedNeighborhood === name) {
                selectedNeighborhood = null;
                selectedRegion = null;

                map.setFilter('neighborhoods-fill', null);
                map.setFilter('neighborhoods-highlight', ['==', 'LISTNAME', '']);
                map.setPaintProperty('neighborhoods-fill', 'fill-opacity', 0.7);

                const listEl = document.getElementById('neighborhood-list');
                listEl.innerHTML = '';
                listEl.classList.remove('active');
                return;
              }

              selectedNeighborhood = name;

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

        });
      });

      // ✅ Map neighborhood click
      map.on('click', 'neighborhoods-fill', (e) => {
        const name = e.features[0].properties.LISTNAME;
        const region = e.features[0].properties.region;

        if (selectedNeighborhood === name) {
          selectedNeighborhood = null;
          selectedRegion = null;

          map.setFilter('neighborhoods-fill', null);
          map.setFilter('neighborhoods-highlight', ['==', 'LISTNAME', '']);
          map.setPaintProperty('neighborhoods-fill', 'fill-opacity', 0.7);

          const listEl = document.getElementById('neighborhood-list');
          listEl.innerHTML = '';
          listEl.classList.remove('active');
          return;
        }

        selectedNeighborhood = name;
        selectedRegion = null;

        map.setFilter('neighborhoods-fill', null);

        map.setFilter('neighborhoods-highlight', ['==', 'LISTNAME', name]);

        map.setPaintProperty('neighborhoods-fill', 'fill-opacity', [
          'case',
          ['==', ['get', 'LISTNAME'], name],
          1,
          0.2
        ]);

        const areaSqKm = (e.features[0].properties.Shape_Area / 1000000).toFixed(2);
        const areaSqMiles = (e.features[0].properties.Shape_Area * 0.000000386102).toFixed(2);
        const description = neighborhoodsInfo[name] || 'No description available for this neighborhood.';

        new mapboxgl.Popup({ closeButton: true, closeOnClick: true })
          .setLngLat(e.lngLat)
          .setHTML(
            `<strong>${name}</strong>` +
            `<p><em>${region}</em> Region | Area: ${areaSqKm} km² (${areaSqMiles} mi²)</p>` +
            `<p>${description}</p>`
          )
          .addTo(map);
      });

      // ✅ Background click reset (FIXED)
      map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['neighborhoods-fill']
        });

        if (!features.length) {
          selectedNeighborhood = null;
          selectedRegion = null;

          map.setFilter('neighborhoods-fill', null);
          map.setFilter('neighborhoods-highlight', ['==', 'LISTNAME', '']);
          map.setPaintProperty('neighborhoods-fill', 'fill-opacity', 0.7);

          const listEl = document.getElementById('neighborhood-list');
          listEl.innerHTML = '';
          listEl.classList.remove('active');
        }
      });

      map.on('mouseenter', 'neighborhoods-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'neighborhoods-fill', () => {
        map.getCanvas().style.cursor = '';
      });

    });

});