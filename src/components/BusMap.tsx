import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import type { BusLocation } from '../api/types';
import { colors, radius } from '../theme/colors';

/**
 * The bus on an OpenStreetMap map (Leaflet in a WebView) - no map SDK or API key needed. New
 * positions are pushed into the page rather than reloading it, so the map keeps the parent's
 * zoom and glides the bus along. The page is given an https origin because OpenStreetMap's tile
 * servers refuse requests that carry no Referer.
 */
const MAP_HTML = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css">
<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { height: 100%; margin: 0; background: #F0EAFA; }
  .bus { width: 34px; height: 34px; border-radius: 17px; background: ${colors.primary}; border: 3px solid #fff;
         box-shadow: 0 2px 6px rgba(0,0,0,.35); display: flex; align-items: center; justify-content: center;
         font-size: 18px; }
</style>
</head><body><div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([22.7, 75.85], 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  var icon = L.divIcon({ className: '', html: '<div class="bus">🚌</div>', iconSize: [34, 34], iconAnchor: [17, 17] });
  var marker = null, trail = null, follow = true;
  map.on('dragstart', function () { follow = false; });
  window.setBus = function (lat, lng) {
    var p = [lat, lng];
    if (!marker) {
      marker = L.marker(p, { icon: icon }).addTo(map);
      trail = L.polyline([p], { color: '${colors.primary}', weight: 4, opacity: 0.6 }).addTo(map);
      map.setView(p, 16);
      return;
    }
    marker.setLatLng(p);
    trail.addLatLng(p);
    if (follow) map.panTo(p, { animate: true });
  };
  window.recenter = function () { follow = true; if (marker) map.setView(marker.getLatLng(), 16); };
</script>
</body></html>`;

interface Props {
  location: BusLocation | null;
  height?: number;
}

export function BusMap({ location, height = 320 }: Props) {
  const webRef = useRef<WebView>(null);
  const loaded = useRef(false);
  const latest = useRef(location);

  const push = (l: BusLocation | null) => {
    if (!l || !loaded.current) return;
    webRef.current?.injectJavaScript(`window.setBus(${Number(l.lat)}, ${Number(l.lng)}); true;`);
  };

  useEffect(() => {
    latest.current = location;
    push(location);
  }, [location?.lat, location?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[styles.frame, { height }]}>
      <WebView
        ref={webRef}
        source={{ html: MAP_HTML, baseUrl: 'https://smartgurukul.org/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        scrollEnabled={false}
        onLoadEnd={() => {
          loaded.current = true;
          push(latest.current);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
});
