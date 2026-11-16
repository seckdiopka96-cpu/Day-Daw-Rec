import { useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, StatusBar, StyleSheet,
  Text, View,
} from "react-native";
import * as Location from "expo-location";
import MapView from "react-native-maps";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

// Native driver app: no simulated online drivers, fabricated income or
// unauthenticated GPS upload. Live dispatch is deliberately disabled.
const DAKAR = {
  latitude: 14.7078,
  longitude: -17.4551,
  latitudeDelta: 0.105,
  longitudeDelta: 0.105,
};
const COLORS = {
  night: "#10392E",
  green: "#127B50",
  lime: "#D5F46A",
  paper: "#FFFFFF",
  background: "#F3F6F3",
  muted: "#73857B",
  border: "#E4EBE5",
};
type Gps = "idle" | "loading" | "ready" | "denied" | "outside" | "error";

const inServiceArea = (latitude: number, longitude: number) =>
  latitude > 14.45 && latitude < 15.25 &&
  longitude > -17.65 && longitude < -16.7;

function DriverHome() {
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);
  const [gps, setGps] = useState<Gps>("idle");
  const [notice, setNotice] = useState("Appuie sur « Me localiser » pour voir ta position.");

  const locate = async () => {
    if (gps === "loading") return;
    setGps("loading");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setGps("denied");
        setNotice("GPS refusé. Autorise-le dans les réglages du téléphone.");
        return;
      }
      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = result.coords;
      if (!inServiceArea(latitude, longitude)) {
        setGps("outside");
        setNotice("Ta position actuelle est hors de la zone pilote de Dakar.");
        return;
      }
      setGps("ready");
      setNotice("Position GPS trouvée. Aucune donnée envoyée au serveur.");
      map.current?.animateToRegion({
        latitude, longitude,
        latitudeDelta: 0.034,
        longitudeDelta: 0.034,
      }, 600);
    } catch {
      setGps("error");
      setNotice("Position indisponible. Réessaie lorsque le GPS est activé.");
    }
  };

  const notOnline = () => Alert.alert(
    "Courses désactivées en préversion",
    "La mise en ligne sera activée après l'authentification sécurisée, le contrôle des documents chauffeur et les tests du dispatch en conditions réelles.",
  );
  const notReady = (label: string) => Alert.alert(
    label + " en préparation",
    "Cet écran sera connecté à ton vrai compte chauffeur. Aucune donnée fictive n'est affichée.",
  );

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={DAKAR}
        showsUserLocation={gps === "ready"}
        showsCompass={false}
        showsTraffic={false}
        toolbarEnabled={false}
        showsMyLocationButton={false}
        loadingEnabled
      />

      <View style={[styles.topWrap, { paddingTop: insets.top + 10 }]}>
        <View style={styles.brandCard}>
          <View style={styles.brandSymbol}>
            <Text style={styles.brandLetter}>D</Text>
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.brand}>DAY DAW REC</Text>
            <Text style={styles.brandSmall}>CHAUFFEUR · AMOUL ARRÊT</Text>
          </View>
          <View style={styles.pilotBadge}><Text style={styles.pilotText}>PILOTE</Text></View>
        </View>
        <View style={styles.offlinePill}>
          <View style={styles.offlineDot} />
          <Text style={styles.offlineText}>Hors ligne · Aucun trajet en cours</Text>
        </View>
      </View>

      <Pressable
        onPress={() => void locate()}
        disabled={gps === "loading"}
        accessibilityRole="button"
        accessibilityLabel="Afficher ma position GPS sur la carte"
        style={[styles.gpsButton, { top: insets.top + 118 }]}
      >
        {gps === "loading"
          ? <ActivityIndicator color={COLORS.green} size="small" />
          : <Text style={styles.gpsIcon}>◎</Text>}
      </Pressable>

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) + 12 }]}>
        <View style={styles.handle} />
        <View style={styles.sheetTop}>
          <View>
            <Text style={styles.eyebrow}>BONJOUR, CHAUFFEUR</Text>
            <Text style={styles.title}>Prêt à prendre la route ?</Text>
          </View>
          <View style={styles.verifiedPlaceholder}><Text style={styles.verifiedText}>Compte à vérifier</Text></View>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Courses aujourd'hui</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>0 F</Text>
            <Text style={styles.statLabel}>Revenus aujourd'hui</Text>
          </View>
        </View>

        <View style={styles.noticeBox}>
          <Text style={styles.noticeIcon}>●</Text>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>

        <View style={styles.actions}>
          <Pressable onPress={() => void locate()} style={styles.secondaryButton} accessibilityRole="button">
            <Text style={styles.secondaryText}>◎  Me localiser</Text>
          </Pressable>
          <Pressable onPress={notOnline} style={styles.mainButton} accessibilityRole="button">
            <Text style={styles.mainText}>Activer les courses  →</Text>
          </Pressable>
        </View>

        <View style={styles.shortcuts}>
          <Pressable onPress={() => notReady("Mes courses")} style={styles.shortcut}>
            <Text style={styles.shortcutIcon}>▤</Text><Text style={styles.shortcutLabel}>Courses</Text>
          </Pressable>
          <Pressable onPress={() => notReady("Mes documents")} style={styles.shortcut}>
            <Text style={styles.shortcutIcon}>▣</Text><Text style={styles.shortcutLabel}>Documents</Text>
          </Pressable>
          <Pressable onPress={() => notReady("Mes revenus")} style={styles.shortcut}>
            <Text style={styles.shortcutIcon}>₣</Text><Text style={styles.shortcutLabel}>Revenus</Text>
          </Pressable>
          <Pressable onPress={() => notReady("Mon profil")} style={styles.shortcut}>
            <Text style={styles.shortcutIcon}>◯</Text><Text style={styles.shortcutLabel}>Profil</Text>
          </Pressable>
        </View>
        <Text style={styles.disclaimer}>PRÉVERSION PRIVÉE · AUCUNE COURSE COMMERCIALE</Text>
      </View>
    </View>
  );
}

export default function App() {
  return <SafeAreaProvider><DriverHome /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  topWrap: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 16 },
  brandCard: { flexDirection: "row", alignItems: "center", borderRadius: 20, padding: 12, backgroundColor: COLORS.night,
    shadowColor: "#061D15", shadowOpacity: 0.18, shadowRadius: 15, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  brandSymbol: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.lime, justifyContent: "center", alignItems: "center" },
  brandLetter: { fontSize: 24, fontWeight: "900", color: COLORS.night },
  brandCopy: { flex: 1, marginLeft: 11 },
  brand: { color: "#FFF", fontWeight: "900", fontSize: 16, letterSpacing: 0.4 },
  brandSmall: { color: "#BBDACD", fontSize: 10, marginTop: 3, letterSpacing: 1, fontWeight: "700" },
  pilotBadge: { borderRadius: 8, paddingVertical: 7, paddingHorizontal: 8, backgroundColor: "#31584A" },
  pilotText: { color: COLORS.lime, fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  offlinePill: { alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 100, paddingVertical: 8, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", marginTop: 10,
    shadowColor: "#061D15", shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  offlineDot: { width: 8, height: 8, borderRadius: 5, backgroundColor: "#D89349", marginRight: 8 },
  offlineText: { color: COLORS.night, fontSize: 12, fontWeight: "700" },
  gpsButton: { position: "absolute", right: 18, borderRadius: 18, width: 48, height: 48,
    alignItems: "center", justifyContent: "center", backgroundColor: "#FFF", elevation: 4,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12 },
  gpsIcon: { fontSize: 31, color: COLORS.green, marginTop: -3 },
  sheet: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: COLORS.paper,
    paddingHorizontal: 20, paddingTop: 11, shadowColor: "#0A2317", shadowOpacity: 0.12, shadowRadius: 22, elevation: 12 },
  handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: "#DDE6DF", alignSelf: "center", marginBottom: 18 },
  sheetTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 17 },
  eyebrow: { color: COLORS.green, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  title: { fontSize: 21, fontWeight: "900", color: COLORS.night, marginTop: 5, letterSpacing: -0.4 },
  verifiedPlaceholder: { backgroundColor: "#F4F6F3", paddingHorizontal: 8, paddingVertical: 8, borderRadius: 9, marginLeft: 6 },
  verifiedText: { fontSize: 9, color: COLORS.muted, fontWeight: "700" },
  stats: { borderRadius: 17, flexDirection: "row", backgroundColor: "#F4F8F5", paddingVertical: 13, marginBottom: 12 },
  stat: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 22, fontWeight: "900", color: COLORS.night },
  statLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "600", marginTop: 3 },
  statDivider: { height: 35, width: 1, backgroundColor: "#DCE6DD", alignSelf: "center" },
  noticeBox: { paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", borderRadius: 12, backgroundColor: "#F8F9F2" },
  noticeIcon: { fontSize: 10, color: "#AC8B46", marginRight: 9 },
  noticeText: { flex: 1, color: "#586A5D", fontSize: 11, lineHeight: 17 },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  secondaryButton: { paddingHorizontal: 13, height: 49, justifyContent: "center", borderRadius: 14, backgroundColor: "#EFF6F1", borderWidth: 1, borderColor: "#DCEADF" },
  secondaryText: { fontSize: 12, color: COLORS.night, fontWeight: "800" },
  mainButton: { flex: 1, height: 49, backgroundColor: COLORS.night, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  mainText: { color: COLORS.lime, fontWeight: "900", fontSize: 13 },
  shortcuts: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, paddingBottom: 12 },
  shortcut: { alignItems: "center", width: "24%" },
  shortcutIcon: { fontSize: 20, color: COLORS.night, fontWeight: "700" },
  shortcutLabel: { fontSize: 11, color: COLORS.muted, fontWeight: "700", marginTop: 5 },
  disclaimer: { textAlign: "center", color: "#95A198", fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
});
