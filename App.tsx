import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  Button,
  Text,
  TouchableOpacity,
  View,
  Animated,
} from "react-native";
import { Audio } from "expo-av";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import "@expo/metro-runtime";
import * as Font from "expo-font";
import * as SplashScreen from "expo-splash-screen";

SplashScreen.preventAutoHideAsync();

export default function App() {
  // https://twitter.com/DavidKPiano/status/1604870393084665856/photo/2
  const [recording, setRecording] = useState<Audio.Recording>();
  const [permission, setPermission] = useState<Audio.PermissionResponse>();
  const [transcription, setTranscription] = useState("");
  const [appIsReady, setAppIsReady] = useState(false);
  const [splashAnimation] = useState(new Animated.Value(1));

  const openSettings = useCallback(async () => {
    // Open the custom settings if the app has one
    await Linking.openSettings();
  }, []);

  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync({
          "Dinish-Regular": require("./assets/fonts/Dinish-Regular.ttf"),
        });
        // Add any other resources you want to load here
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
      Animated.timing(splashAnimation, {
        toValue: 0,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }
  }, [appIsReady]);

  async function startRecording() {
    // Ask or get permission from the user to use their device's microphone
    // to record the user's voice
    const permission = await Audio.requestPermissionsAsync();

    // Store the permission in device memory so we (the app) can inform the user
    // on their set permission.
    // i.e. 'You previously denied permission. Please check your settings.'
    setPermission(permission);

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );

    setRecording(recording);
  }

  async function stopRecording() {
    if (!recording) {
      return;
    }

    await recording.stopAndUnloadAsync();

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });

    const uri = recording.getURI();
    if (typeof uri === "string") {
      setRecording(undefined);
      await transcribeAudio(uri);
    }
  }

  const transcribeAudio = async (audioUri: string) => {
    const formData = new FormData();

    // This code will break if you touch it
    if (Platform.OS === "ios" || Platform.OS === "android") {
      formData.append("recording.m4a", {
        uri: audioUri,
        type: "audio/m4a",
        name: "recording.m4a",
      } as any);
    } else if (Platform.OS === "web") {
      const audioResponse = await fetch(audioUri);
      const audioEncodedBytes = await audioResponse.blob();

      formData.append("recording.webm", audioEncodedBytes, "recording.webm");
    }

    try {
      const response = await fetch(
        "https://twyv.martinshameti.com/transcribe",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      setTranscription(data.text);
    } catch (e) {
      console.log(e);
    }
  };

  if (!appIsReady) {
    return null;
  }

  return (
    <View onLayout={onLayoutRootView} style={styles.container}>
      <TouchableOpacity onPress={recording ? stopRecording : startRecording}>
        <Text style={{ fontFamily: "Dinish-Regular", fontSize: 16 }}>
          {recording ? "Stop Recording" : "Start Recording"}
        </Text>
      </TouchableOpacity>

      <Text>{transcription}</Text>

      {permission?.status === Audio.PermissionStatus.DENIED && (
        <Text>You previously denied mic permission</Text>
      )}

      {(Platform.OS === "ios" || Platform.OS === "android") &&
        permission?.status === Audio.PermissionStatus.DENIED && (
          <Button title="Open Settings" onPress={openSettings} />
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
