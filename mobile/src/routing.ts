import { GeoPoint, inDakar } from "./places";

export type Route = {
  coordinates: GeoPoint[];
  kilometers: number;
  minutes: number;
};

// OSRM's public routing endpoint is a demonstration service only.
// For commercial usage configure a dedicated routing provider or self-host OSRM.
export async function getTestRoadRoute(from: GeoPoint, to: GeoPoint): Promise<Route> {
  if (!inDakar(from) || !inDakar(to)) {
    throw new Error("Les itinéraires de test sont limités à la région de Dakar.");
  }
  const url = "https://router.project-osrm.org/route/v1/driving/" +
    from.longitude + "," + from.latitude + ";" +
    to.longitude + "," + to.latitude +
    "?overview=full&geometries=geojson";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error("Service d'itinéraire temporairement indisponible.");
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") throw new Error("Réponse d'itinéraire invalide.");
    const data = payload as {
      code?: string;
      routes?: { distance?: number; duration?: number; geometry?: { coordinates?: number[][] } }[];
    };
    const first = data.routes?.[0];
    if (data.code !== "Ok" || !first?.geometry?.coordinates?.length ||
        !Number.isFinite(first.distance) || !Number.isFinite(first.duration)) {
      throw new Error("Aucun itinéraire routier trouvé pour ce trajet.");
    }
    const coords = first.geometry.coordinates;
    if (coords.length > 25000) throw new Error("Itinéraire trop long.");
    const coordinates = coords.map(([longitude, latitude]) => ({ latitude, longitude }))
      .filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
    if (coordinates.length < 2) throw new Error("Itinéraire invalide.");
    return {
      coordinates,
      kilometers: (first.distance as number) / 1000,
      minutes: (first.duration as number) / 60,
    };
  } finally {
    clearTimeout(timeout);
  }
}
