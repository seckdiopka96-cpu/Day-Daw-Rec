export type GeoPoint = { latitude: number; longitude: number };
export type Place = GeoPoint & { name: string };

export const DAKAR = {
  latitude: 14.7078,
  longitude: -17.4551,
  latitudeDelta: 0.105,
  longitudeDelta: 0.105,
};

export const PLACES: Place[] = [
  { name: "Dakar Plateau", latitude: 14.6694, longitude: -17.4317 },
  { name: "Almadies", latitude: 14.738, longitude: -17.517 },
  { name: "Ouakam", latitude: 14.7246, longitude: -17.4905 },
  { name: "Yoff", latitude: 14.7578, longitude: -17.4753 },
  { name: "Mermoz", latitude: 14.7022, longitude: -17.4641 },
  { name: "Médina", latitude: 14.6886, longitude: -17.4472 },
  { name: "Parcelles Assainies", latitude: 14.7522, longitude: -17.4486 },
  { name: "Pikine", latitude: 14.7521, longitude: -17.3935 },
  { name: "Guédiawaye", latitude: 14.7716, longitude: -17.402 },
  { name: "Rufisque", latitude: 14.7138, longitude: -17.2733 },
];

export function inDakar(point: GeoPoint): boolean {
  return point.latitude > 14.45 && point.latitude < 15.25 &&
    point.longitude > -17.65 && point.longitude < -16.7;
}
