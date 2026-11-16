import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  confirmCode, logOut, restoreProfile, startCode,
  type Intent, type Profile, type Role,
} from "./auth";

type Props = {
  role:Role;
  children:(profile:Profile,signOut:()=>void)=>ReactNode;
};
type Phase = "details" | "code";

export default function AuthGate({role,children}:Props) {
  const inset=useSafeAreaInsets();
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [phase,setPhase]=useState<Phase>("details");
  const [intent,setIntent]=useState<Intent>("signup");
  const [phone,setPhone]=useState("");
  const [verifiedPhone,setVerifiedPhone]=useState("");
  const [name,setName]=useState("");
  const [vehicle,setVehicle]=useState("");
  const [plate,setPlate]=useState("");
  const [code,setCode]=useState("");
  const [error,setError]=useState("");
  const isDriver=role==="driver";
  const accent=isDriver?"#D5F46A":"#FFCC41";

  useEffect(()=>{
    let mounted=true;
    restoreProfile(role).then(found=>{
      if(mounted)setProfile(found);
    }).catch(e=>{
      if(mounted)setError(e instanceof Error?e.message:"Connexion temporairement indisponible.");
    }).finally(()=>{if(mounted)setLoading(false)});
    return ()=>{mounted=false};
  },[role]);

  const send=async()=>{
    if(busy)return;
    setBusy(true);setError("");
    try{
      const canonical=await startCode({
        role,intent,phone,
        ...(intent==="signup"?{
          full_name:name.trim(),
          ...(isDriver?{
            vehicle_type:vehicle.trim(),
            license_plate:plate.trim().toUpperCase(),
          }:{})
        }:{})
      });
      setVerifiedPhone(canonical);setCode("");setPhase("code");
    }catch(e){setError(e instanceof Error?e.message:"Impossible d'envoyer le SMS.");}
    finally{setBusy(false);}
  };
  const verify=async()=>{
    if(busy)return;
    setBusy(true);setError("");
    try{
      const found=await confirmCode(verifiedPhone,code,role);
      setProfile(found);setCode("");
    }catch(e){setError(e instanceof Error?e.message:"Vérification impossible.");}
    finally{setBusy(false);}
  };
  const signOut=async()=>{
    if(busy)return;
    setBusy(true);
    try{
      await logOut();
      setProfile(null);setPhase("details");setIntent("login");
      setCode("");setError("");
    }catch(e){
      Alert.alert("Déconnexion",e instanceof Error?e.message:"Réessaie avec une connexion Internet.");
    }finally{setBusy(false);}
  };

  if(loading)return(
    <View style={styles.loading}>
      <StatusBar barStyle="dark-content" />
      <ActivityIndicator size="large" color="#127B50" />
      <Text style={styles.loadingText}>Connexion sécurisée…</Text>
    </View>
  );
  if(profile)return <>{children(profile,()=>{void signOut()})}</>;

  return(
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS==="ios"?"padding":undefined}
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll,{paddingTop:inset.top+32,paddingBottom:inset.bottom+28}]}
      >
        <View style={[styles.logo,{backgroundColor:accent}]}>
          <Text style={styles.logoText}>D</Text>
        </View>
        <Text style={styles.brand}>DAY DAW REC</Text>
        <Text style={styles.slogan}>AMOUL ARRÊT · DAKAR</Text>
        <View style={styles.headingRow}>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{isDriver?"🚘 ESPACE CHAUFFEUR":"🚕 ESPACE CLIENT"}</Text>
          </View>
        </View>
        <Text style={styles.title}>{phase==="details"
          ? intent==="signup"?"Bienvenue à bord":"Heureux de te revoir"
          :"Vérifie ton numéro"}</Text>
        <Text style={styles.subTitle}>{phase==="details"
          ?"Un compte sécurisé avec ton numéro sénégalais."
          :"Nous avons envoyé un code SMS au "+verifiedPhone+"."}</Text>

        {phase==="details"?(
          <>
            <View style={styles.tabs}>
              <Pressable onPress={()=>{setIntent("signup");setError("")}}
                style={[styles.tab,intent==="signup"&&styles.activeTab]}>
                <Text style={[styles.tabText,intent==="signup"&&styles.activeTabText]}>Créer un compte</Text>
              </Pressable>
              <Pressable onPress={()=>{setIntent("login");setError("")}}
                style={[styles.tab,intent==="login"&&styles.activeTab]}>
                <Text style={[styles.tabText,intent==="login"&&styles.activeTabText]}>Se connecter</Text>
              </Pressable>
            </View>
            {intent==="signup"&&(
              <>
                <Text style={styles.label}>NOM COMPLET</Text>
                <TextInput
                  style={styles.input} value={name} onChangeText={setName}
                  placeholder="Prénom et nom" placeholderTextColor="#8C9B91"
                  autoCapitalize="words" autoComplete="name" maxLength={80}
                  accessibilityLabel="Nom complet"
                />
              </>
            )}
            <Text style={styles.label}>NUMÉRO DE TÉLÉPHONE</Text>
            <View style={styles.phoneRow}>
              <View style={styles.country}><Text style={styles.countryText}>🇸🇳 +221</Text></View>
              <TextInput
                style={styles.phoneInput} value={phone} onChangeText={setPhone}
                keyboardType="phone-pad" textContentType="telephoneNumber"
                autoComplete="tel" placeholder="77 123 45 67"
                placeholderTextColor="#8C9B91" maxLength={18}
                accessibilityLabel="Numéro sénégalais"
              />
            </View>
            {intent==="signup"&&isDriver&&(
              <>
                <Text style={styles.label}>TYPE DE VÉHICULE</Text>
                <TextInput
                  style={styles.input} value={vehicle} onChangeText={setVehicle}
                  placeholder="Ex. Toyota Corolla" placeholderTextColor="#8C9B91"
                  maxLength={40} autoCapitalize="words"
                />
                <Text style={styles.label}>PLAQUE D'IMMATRICULATION</Text>
                <TextInput
                  style={styles.input} value={plate} onChangeText={setPlate}
                  placeholder="Ex. DK 1234 AB" placeholderTextColor="#8C9B91"
                  maxLength={30} autoCapitalize="characters"
                />
                <Text style={styles.driverNotice}>
                  L'inscription ne donne pas l'autorisation de conduire :
                  ton permis, tes documents et ton véhicule devront être vérifiés.
                </Text>
              </>
            )}
          </>
        ):(
          <>
            <Text style={styles.label}>CODE REÇU PAR SMS</Text>
            <TextInput
              style={[styles.input,styles.codeInput]}
              value={code} onChangeText={v=>setCode(v.replace(/\D/g,""))}
              keyboardType="number-pad" textContentType="oneTimeCode"
              autoComplete="sms-otp" maxLength={10} placeholder="••••••"
              placeholderTextColor="#8C9B91" accessibilityLabel="Code SMS"
            />
            <Pressable onPress={()=>{setPhase("details");setCode("");setError("")}}
              style={styles.changeNumber}>
              <Text style={styles.changeNumberText}>Modifier mon numéro ou renvoyer un code</Text>
            </Pressable>
          </>
        )}

        {error!==""&&(
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        <Pressable
          style={[styles.submit,{backgroundColor:accent},busy&&styles.disabled]}
          onPress={()=>{void (phase==="details"?send():verify())}}
          disabled={busy}
          accessibilityRole="button"
        >
          {busy?<ActivityIndicator color="#10392E"/>:
            <Text style={styles.submitText}>
              {phase==="details"?"Recevoir mon code SMS  →":"Valider et continuer  →"}
            </Text>}
        </Pressable>
        <Text style={styles.disclaimer}>
          Un SMS réel est nécessaire. Aucun compte fictif n'est créé.
          Les courses commerciales ne sont pas encore activées.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:"#F6F8F5"},
  scroll:{flexGrow:1,paddingHorizontal:24},
  loading:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:"#F6F8F5"},
  loadingText:{marginTop:14,color:"#678071",fontWeight:"700"},
  logo:{width:60,height:60,borderRadius:19,alignItems:"center",justifyContent:"center"},
  logoText:{fontSize:36,fontWeight:"900",color:"#10392E"},
  brand:{fontSize:22,fontWeight:"900",color:"#10392E",marginTop:20,letterSpacing:0.2},
  slogan:{fontSize:11,fontWeight:"700",letterSpacing:1.5,color:"#788B7F",marginTop:5},
  headingRow:{flexDirection:"row",marginTop:33},
  roleBadge:{backgroundColor:"#E6EFE8",paddingHorizontal:11,paddingVertical:7,borderRadius:9},
  roleBadgeText:{fontSize:10,fontWeight:"900",color:"#127B50",letterSpacing:0.5},
  title:{fontSize:26,fontWeight:"900",color:"#10392E",marginTop:18,letterSpacing:-0.4},
  subTitle:{fontSize:14,color:"#71847A",marginTop:8,marginBottom:20,lineHeight:21},
  tabs:{flexDirection:"row",backgroundColor:"#E9EFEB",padding:4,borderRadius:14,marginBottom:18},
  tab:{flex:1,paddingVertical:13,alignItems:"center",borderRadius:11},
  activeTab:{backgroundColor:"#FFFFFF"},
  tabText:{fontSize:13,fontWeight:"700",color:"#6E8175"},
  activeTabText:{color:"#123A2D",fontWeight:"900"},
  label:{fontSize:10,fontWeight:"900",color:"#496658",letterSpacing:1.1,marginBottom:8,marginTop:14},
  input:{height:54,borderWidth:1,borderColor:"#DEE9DF",borderRadius:14,
    backgroundColor:"#FFFFFF",paddingHorizontal:15,fontSize:15,color:"#10392E"},
  phoneRow:{flexDirection:"row",borderWidth:1,borderColor:"#DEE9DF",borderRadius:14,
    backgroundColor:"#FFFFFF",height:54,alignItems:"center",overflow:"hidden"},
  country:{paddingHorizontal:14,borderRightWidth:1,borderRightColor:"#E7ECE8",height:30,justifyContent:"center"},
  countryText:{fontSize:13,fontWeight:"800",color:"#10392E"},
  phoneInput:{flex:1,height:54,paddingHorizontal:13,color:"#10392E",fontSize:16},
  codeInput:{fontSize:24,fontWeight:"800",letterSpacing:7,textAlign:"center"},
  driverNotice:{fontSize:11,color:"#667C6C",lineHeight:17,marginTop:13},
  changeNumber:{paddingVertical:14,alignSelf:"flex-start"},
  changeNumberText:{fontSize:12,color:"#127B50",fontWeight:"800"},
  errorBox:{marginTop:15,backgroundColor:"#FFF0ED",padding:12,borderRadius:12},
  errorText:{color:"#A53A34",fontSize:12,lineHeight:18,fontWeight:"600"},
  submit:{minHeight:55,borderRadius:15,justifyContent:"center",alignItems:"center",marginTop:20},
  disabled:{opacity:0.65},
  submitText:{fontSize:14,color:"#10392E",fontWeight:"900"},
  disclaimer:{color:"#829388",fontSize:11,lineHeight:17,marginTop:17,textAlign:"center"},
});
