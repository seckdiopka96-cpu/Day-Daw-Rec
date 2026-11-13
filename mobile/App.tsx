import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, Pressable, ScrollView, StatusBar,
  StyleSheet, Text, View,
} from "react-native";
import * as Location from "expo-location";
import MapView, { Marker, Polyline, type MapPressEvent } from "react-native-maps";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { DAKAR, PLACES, inDakar, type GeoPoint, type Place } from "./src/places";
import { getTestRoadRoute, type Route } from "./src/routing";

type Mode = "client" | "driver";
const COLORS = {
  ink: "#183329", green: "#127B50", dark: "#103C2D",
  lemon: "#FFCC41", muted: "#74877B", line: "#E5EBE6", background: "#FFFFFF",
};
const gpsLabel = (position: GeoPoint | null, hasPermission: boolean) => {
  if (!hasPermission) return "Autoriser la localisation";
  if (!position) return "Touchez la carte pour choisir un départ";
  return "Position sur la carte";
};

function Screen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [mode, setMode] = useState<Mode>("client");
  const [position, setPosition] = useState<GeoPoint | null>(null);
  const [pickup, setPickup] = useState<GeoPoint | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [gpsAllowed, setGpsAllowed] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [notice, setNotice] = useState("Touchez la carte pour choisir le point de départ.");
  const [showPlaces, setShowPlaces] = useState(true);

  useEffect(() => {
    let active = true;
    const ask = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        setGpsAllowed(permission.granted);
        if (!permission.granted) {
          setNotice("GPS refusé. Vous pouvez placer votre départ manuellement sur Dakar.");
          return;
        }
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!active) return;
        const p = { latitude: location.coords.latitude, longitude: location.coords.longitude };
        setPosition(p);
        if (inDakar(p)) {
          setPickup(p);
          setNotice("Position GPS trouvée.");
          mapRef.current?.animateToRegion({
            ...p, latitudeDelta: 0.045, longitudeDelta: 0.045,
          }, 600);
        } else {
          setNotice("Votre GPS est hors de Dakar. Choisissez votre départ sur la carte.");
        }
      } catch {
        if (active) setNotice("GPS indisponible. Vous pouvez choisir un départ sur la carte.");
      }
    };
    void ask();
    return () => { active = false; };
  }, []);

  const recenter = async () => {
    setGpsLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      setGpsAllowed(permission.granted);
      if (!permission.granted) {
        Alert.alert("Localisation", "Autorisez la localisation dans les réglages du téléphone.");
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const p = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      setPosition(p);
      if (!inDakar(p)) {
        Alert.alert("Hors de Dakar", "Votre position actuelle est hors de la zone de service. La carte reste centrée sur Dakar.");
        return;
      }
      setPickup(p);
      setRoute(null);
      mapRef.current?.animateToRegion({ ...p, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 650);
      setNotice("Départ positionné avec le GPS réel.");
    } catch {
      Alert.alert("GPS indisponible", "Réessayez ou sélectionnez votre point de départ sur la carte.");
    } finally {
      setGpsLoading(false);
    }
  };

  const pressMap = (event: MapPressEvent) => {
    if (mode !== "client") return;
    const chosen = event.nativeEvent.coordinate;
    if (!inDakar(chosen)) {
      setNotice("Les départs doivent se situer dans la région de Dakar.");
      return;
    }
    setPickup(chosen);
    setRoute(null);
    setNotice("Point de départ choisi sur la carte.");
  };

  const chooseDestination = (place: Place) => {
    setDestination(place);
    setRoute(null);
    setNotice("Destination choisie : " + place.name + ".");
    setShowPlaces(false);
    mapRef.current?.animateToRegion({
      latitude: place.latitude, longitude: place.longitude,
      latitudeDelta: 0.085, longitudeDelta: 0.085,
    }, 500);
  };

  const calculateRoute = async () => {
    if (!pickup || !destination) {
      Alert.alert("Trajet", "Placez votre départ sur la carte et choisissez une destination.");
      return;
    }
    setLoadingRoute(true);
    setNotice("Recherche d'un itinéraire routier réel…");
    try {
      const found = await getTestRoadRoute(pickup, destination);
      setRoute(found);
      setNotice("Itinéraire routier calculé. Cette estimation n'est pas un tarif commercial.");
      mapRef.current?.fitToCoordinates(found.coordinates, {
        edgePadding: { top: 155, right: 70, bottom: 370, left: 70 },
        animated: true,
      });
    } catch (error) {
      setRoute(null);
      Alert.alert("Itinéraire indisponible", error instanceof Error ? error.message : "Veuillez réessayer.");
      setNotice("La carte reste disponible. Le service de calcul d'itinéraire peut être temporairement indisponible.");
    } finally {
      setLoadingRoute(false);
    }
  };

  const notYetAvailable = () => Alert.alert(
    "Réservations en préparation",
    "Cette application mobile native dispose d'une vraie carte et du GPS. Les courses réelles seront activées après l'inscription sécurisée et la validation des chauffeurs.",
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={DAKAR}
        showsCompass={false}
        showsTraffic={false}
        showsUserLocation={gpsAllowed}
        showsMyLocationButton={false}
        onPress={pressMap}
        toolbarEnabled={false}
        loadingEnabled
      >
        {pickup && <Marker
          coordinate={pickup}
          pinColor={COLORS.green}
          title="Votre départ"
          description="Point de départ sélectionné"
        />}
        {destination && <Marker
          coordinate={destination}
          pinColor={COLORS.dark}
          title={destination.name}
          description="Votre destination"
        />}
        {route && <Polyline
          coordinates={route.coordinates}
          strokeColor={COLORS.green}
          strokeWidth={5}
          lineCap="round"
          lineJoin="round"
        />}
      </MapView>

      <View style={[styles.headerWrap, { paddingTop: insets.top + 8 }]}>
        <View style={styles.brandCard}>
          <View style={styles.logo}><Text style={styles.logoText}>D</Text></View>
          <View style={styles.brandText}>
            <Text style={styles.brandName}>DAY DAW <Text style={styles.brandAccent}>REC</Text></Text>
            <Text style={styles.brandSubtitle}>AMOUL ARRÊT · DAKAR</Text>
          </View>
          <View style={styles.tag}><Text style={styles.tagText}>NATIVE</Text></View>
        </View>
      </View>

      <Pressable
        style={[styles.gpsButton, { top: insets.top + 96 }]}
        accessibilityRole="button"
        accessibilityLabel="Utiliser ma position GPS"
        onPress={() => void recenter()}
        disabled={gpsLoading}
      >
        {gpsLoading ? <ActivityIndicator size="small" color={COLORS.green} /> :
          <Text style={styles.gpsSymbol}>◎</Text>}
      </Pressable>

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12) + 13 }]}>
        <View style={styles.handle} />
        <View style={styles.modeSwitch}>
          <Pressable
            onPress={() => setMode("client")}
            style={[styles.modeButton, mode === "client" && styles.modeActive]}
            accessibilityRole="button"
          ><Text style={[styles.modeText, mode === "client" && styles.modeTextActive]}>👤 Client</Text></Pressable>
          <Pressable
            onPress={() => setMode("driver")}
            style={[styles.modeButton, mode === "driver" && styles.modeActive]}
            accessibilityRole="button"
          ><Text style={[styles.modeText, mode === "driver" && styles.modeTextActive]}>🚘 Chauffeur</Text></Pressable>
        </View>

        {mode === "client" ? (
          <>
            <Text style={styles.heading}>Où allons-nous ?</Text>
            <View style={styles.addressRow}>
              <View style={styles.dot} />
              <View style={styles.addressText}>
                <Text style={styles.fieldTitle}>POINT DE DÉPART</Text>
                <Text numberOfLines={1} style={styles.fieldValue}>{gpsLabel(pickup, gpsAllowed)}</Text>
              </View>
              <Pressable onPress={() => void recenter()} accessibilityRole="button">
                <Text style={styles.actionText}>GPS</Text>
              </Pressable>
            </View>
            <Pressable style={styles.addressRow} onPress={() => setShowPlaces(!showPlaces)}>
              <View style={[styles.dot, styles.dotEnd]} />
              <View style={styles.addressText}>
                <Text style={styles.fieldTitle}>DESTINATION</Text>
                <Text numberOfLines={1} style={styles.fieldValue}>
                  {destination?.name ?? "Choisir un quartier de Dakar"}
                </Text>
              </View>
              <Text style={styles.chevron}>⌄</Text>
            </Pressable>
            {showPlaces && <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.places}
              keyboardShouldPersistTaps="handled"
            >
              {PLACES.map(place => (
                <Pressable
                  key={place.name}
                  onPress={() => chooseDestination(place)}
                  style={[styles.placeChip, destination?.name === place.name && styles.placeChipActive]}
                >
                  <Text style={[styles.placeChipText, destination?.name === place.name && styles.placeChipTextActive]}>
                    {place.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>}
            {route && <View style={styles.routeInfo}>
              <Text style={styles.routeInfoText}>🛣️ {route.kilometers.toFixed(1)} km · environ {Math.round(route.minutes)} min</Text>
              <Text style={styles.routeNote}>Calcul routier de test · sans tarif confirmé</Text>
            </View>}
            <Text style={styles.notice} numberOfLines={2}>{notice}</Text>
            <Pressable style={styles.primaryButton} onPress={() => void calculateRoute()} disabled={loadingRoute}>
              {loadingRoute ? <ActivityIndicator color={COLORS.dark} /> :
                <Text style={styles.primaryButtonText}>Voir l'itinéraire réel     →</Text>}
            </Pressable>
            {route && <Pressable style={styles.secondaryButton} onPress={notYetAvailable}>
              <Text style={styles.secondaryButtonText}>Réserver une voiture (prochainement)</Text>
            </Pressable>}
          </>
        ) : (
          <>
            <Text style={styles.heading}>Espace chauffeur</Text>
            <Text style={styles.driverDescription}>Suivez votre emplacement sur la carte. L'envoi des positions et l'attribution de vraies courses nécessitent un compte chauffeur validé.</Text>
            <View style={styles.driverStatus}>
              <Text style={styles.driverStatusTitle}>● {gpsAllowed ? "Localisation autorisée" : "GPS non autorisé"}</Text>
              <Text style={styles.routeNote}>Aucune course ni position envoyée au serveur</Text>
            </View>
            <Pressable style={styles.primaryButton} onPress={() => void recenter()}>
              <Text style={styles.primaryButtonText}>📍 Afficher ma position</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={notYetAvailable}>
              <Text style={styles.secondaryButtonText}>Activer les courses réelles (prochainement)</Text>
            </Pressable>
          </>
        )}
        <Text style={styles.footer}>PRÉVERSION NATIVE · PAS ENCORE OUVERTE AUX COURSES COMMERCIALES</Text>
      </View>
    </View>
  );
}

export default function App() {
  return <SafeAreaProvider><Screen /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  headerWrap: { position: "absolute", left: 16, right: 16 },
  brandCard: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 20, backgroundColor: "white", shadowColor: "#132D21", shadowOpacity: 0.13, shadowRadius: 18, shadowOffset: { width: 0, height: 7 }, elevation: 7 },
  logo: { width: 43, height: 43, borderRadius: 13, backgroundColor: COLORS.lemon, alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: 25, fontWeight: "900", color: COLORS.dark },
  brandText: { flex: 1, marginLeft: 10 },
  brandName: { fontSize: 18, fontWeight: "900", color: COLORS.dark, letterSpacing: -0.9 },
  brandAccent: { color: COLORS.green },
  brandSubtitle: { fontSize: 8, color: COLORS.muted, letterSpacing: 2, marginTop: 3, fontWeight: "700" },
  tag: { borderRadius: 9, backgroundColor: "#E8F6EC", paddingHorizontal: 7, paddingVertical: 6 },
  tagText: { color: COLORS.green, fontSize: 9, fontWeight: "800" },
  gpsButton: { position: "absolute", right: 16, width: 54, height: 54, backgroundColor: "white", alignItems: "center", justifyContent: "center", borderRadius: 17, shadowColor: "#173D29", shadowOpacity: 0.13, shadowRadius: 8, elevation: 6 },
  gpsSymbol: { color: COLORS.green, fontSize: 36, fontWeight: "700", marginTop: -7 },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 11, backgroundColor: "#FFFFFF", borderTopLeftRadius: 29, borderTopRightRadius: 29, shadowColor: "#10251B", shadowOpacity: 0.15, shadowRadius: 18, shadowOffset: { width: 0, height: -6 }, elevation: 16 },
  handle: { width: 42, height: 5, borderRadius: 8, backgroundColor: "#D8DDD7", alignSelf: "center", marginBottom: 14 },
  modeSwitch: { backgroundColor: "#F2F5F0", borderRadius: 13, padding: 4, flexDirection: "row", marginBottom: 13 },
  modeButton: { flex: 1, paddingVertical: 11, alignItems: "center", borderRadius: 10 },
  modeActive: { backgroundColor: COLORS.dark },
  modeText: { fontSize: 13, color: "#4A685A", fontWeight: "700" },
  modeTextActive: { color: "#FFFFFF" },
  heading: { fontSize: 25, letterSpacing: -1, fontWeight: "900", color: COLORS.ink, marginBottom: 14 },
  addressRow: { minHeight: 56, borderWidth: 1, borderColor: COLORS.line, borderRadius: 13, marginBottom: 9, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF" },
  dot: { height: 12, width: 12, borderRadius: 6, backgroundColor: COLORS.green, marginRight: 13 },
  dotEnd: { backgroundColor: COLORS.lemon, borderRadius: 3 },
  addressText: { flex: 1 },
  fieldTitle: { fontSize: 9, color: COLORS.muted, fontWeight: "900", letterSpacing: 1.4 },
  fieldValue: { fontSize: 14, fontWeight: "700", color: COLORS.ink, marginTop: 5 },
  actionText: { color: COLORS.green, fontWeight: "900", fontSize: 12, marginLeft: 8 },
  chevron: { color: COLORS.green, fontSize: 24, paddingHorizontal: 5 },
  places: { gap: 8, paddingBottom: 7, paddingTop: 3 },
  placeChip: { paddingVertical: 10, paddingHorizontal: 13, borderRadius: 12, backgroundColor: "#F0F5F1", borderWidth: 1, borderColor: COLORS.line },
  placeChipActive: { backgroundColor: COLORS.dark },
  placeChipText: { fontSize: 12, color: COLORS.ink, fontWeight: "700" },
  placeChipTextActive: { color: "#FFFFFF" },
  routeInfo: { borderRadius: 13, backgroundColor: "#EBF6EC", padding: 12, marginTop: 6 },
  routeInfoText: { color: COLORS.dark, fontWeight: "800", fontSize: 14 },
  routeNote: { fontSize: 11, color: COLORS.muted, marginTop: 4, lineHeight: 16 },
  notice: { fontSize: 11, color: COLORS.muted, marginVertical: 10, lineHeight: 15 },
  primaryButton: { backgroundColor: COLORS.lemon, minHeight: 52, borderRadius: 15, alignItems: "center", justifyContent: "center", marginTop: 3 },
  primaryButtonText: { fontSize: 14, fontWeight: "900", color: COLORS.dark },
  secondaryButton: { alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  secondaryButtonText: { fontSize: 12, fontWeight: "700", color: COLORS.green },
  driverDescription: { fontSize: 14, lineHeight: 22, color: COLORS.muted, marginBottom: 14 },
  driverStatus: { backgroundColor: "#EFF6EF", padding: 14, borderRadius: 14, marginBottom: 12 },
  driverStatusTitle: { fontSize: 14, fontWeight: "800", color: COLORS.green },
  footer: { textAlign: "center", fontSize: 8, letterSpacing: 1, fontWeight: "700", color: "#9AA89C", marginTop: 6 },
});
