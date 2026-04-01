const axios = require("axios");

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const haversineDistanceKm = (origin, destination) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(destination.lat - origin.lat);
  const dLng = toRadians(destination.lng - origin.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(origin.lat)) *
      Math.cos(toRadians(destination.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const getGoogleRoute = async (origin, destination) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const response = await axios.get("https://maps.googleapis.com/maps/api/directions/json", {
    params: {
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      key
    },
    timeout: 8000
  });

  const route = response.data?.routes?.[0]?.legs?.[0];
  if (!route) return null;

  return {
    distanceKm: Number((route.distance.value / 1000).toFixed(2)),
    durationMin: Number((route.duration.value / 60).toFixed(1)),
    source: "google"
  };
};

const getOsmRoute = async (origin, destination) => {
  const baseUrl = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";
  const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;

  const response = await axios.get(`${baseUrl}/route/v1/driving/${coordinates}`, {
    params: { overview: "false" },
    timeout: 8000
  });

  const route = response.data?.routes?.[0];
  if (!route) return null;

  return {
    distanceKm: Number((route.distance / 1000).toFixed(2)),
    durationMin: Number((route.duration / 60).toFixed(1)),
    source: "openstreetmap-osrm"
  };
};

const getRouteMetadata = async (origin, destination) => {
  const provider = String(process.env.MAP_PROVIDER || "osm").toLowerCase();

  try {
    if (provider === "google") {
      const google = await getGoogleRoute(origin, destination);
      if (google) return google;
    }

    const osm = await getOsmRoute(origin, destination);
    if (osm) return osm;
  } catch (error) {
    console.warn("Route provider failed. Falling back to haversine.", error.message);
  }

  const distanceKm = haversineDistanceKm(origin, destination);
  return {
    distanceKm: Number(distanceKm.toFixed(2)),
    durationMin: Number(((distanceKm / 40) * 60).toFixed(1)),
    source: "haversine"
  };
};

module.exports = {
  haversineDistanceKm,
  getRouteMetadata
};
