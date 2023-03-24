import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  Button,
  Text,
  TouchableOpacity,
  View,
  Animated,
  FlatList,
} from "react-native";
import { Audio } from "expo-av";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import "@expo/metro-runtime";
import * as Font from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import "expo-dev-client";

SplashScreen.preventAutoHideAsync();
let didInit = false;

const AUDIO_CONFIGURATION = {
  ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
  ios: {
    ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
    audioQuality: Audio.IOSAudioQuality.LOW,
    bitRate: 8000,
    sampleRate: 8000,
    numberOfChannels: 1,
  },
  android: {
    ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
    bitRate: 8000,
    sampleRate: 8000,
    numberOfChannels: 1,
  },
  web: { bitsPerSecond: 6000, mimeType: "audio/webm" },
};

interface Set {
  weight: number;
  unit: string;
  reps: number;
}
export default function App() {
  // https://twitter.com/DavidKPiano/status/1604870393084665856/photo/2
  const [recording, setRecording] = useState<Audio.Recording>();
  const [isRecording, setIsRecording] = useState<boolean>(false);

  const [permission, setPermission] = useState<Audio.PermissionResponse>();
  const [exercises, setExercises] = useState([]);
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

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
        });
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }

    if (!didInit) {
      didInit = true;
      prepare();
    }
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
    setPermission(await Audio.requestPermissionsAsync());

    recordingLoop();
  }

  async function recordingLoop(previousRecording?: Audio.Recording) {
    if (previousRecording) {
      await previousRecording.stopAndUnloadAsync();
      pushRecording(previousRecording);

      if (!isRecording) {
        return;
      }
    }

    const { recording } = await Audio.Recording.createAsync(
      AUDIO_CONFIGURATION
    );
    setRecording(recording);
    await new Promise((resolve) => setTimeout(resolve, 30000));
    await recordingLoop(recording);
  }

  async function stopRecording(recording: Audio.Recording) {
    setIsRecording(false);

    await recording.stopAndUnloadAsync();

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });

    setRecording(undefined);
  }

  async function pushRecording(recording: Audio.Recording) {
    const uri = recording.getURI();
    // const uri = "assets/Recording.m4a" // test with premade recording
    if (typeof uri === "string") {
      setRecording(undefined);

      const formData = new FormData();

      // This code will break if you touch it
      if (Platform.OS === "ios" || Platform.OS === "android") {
        formData.append("recording.m4a", {
          uri: uri,
          type: "audio/m4a",
          name: "recording.m4a",
        } as any);
      } else if (Platform.OS === "web") {
        const audioResponse = await fetch(uri);
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

        setExercises(data.exercises);
      } catch (e) {
        console.log(e);
      }
    }
  }

  const renderItem = ({ item }: { item: { name: string; sets: Set[] } }) => (
    <View style={styles.exerciseContainer}>
      <Text style={styles.exerciseName}>{item.name}</Text>
      {item.sets.map((set, index) => (
        <Text key={index} style={styles.setInfo}>
          Set {index + 1}: {set.weight} {set.unit}, {set.reps} reps
        </Text>
      ))}
    </View>
  );

  if (!appIsReady) {
    return null;
  }
  return (
    <View onLayout={onLayoutRootView} style={styles.container}>
      <TouchableOpacity
        onPress={recording ? () => stopRecording(recording) : startRecording}
      >
        <Text style={{ fontFamily: "Dinish-Regular", fontSize: 64 }}>
          {recording ? "Stop Recording" : "Start Recording"}
        </Text>
      </TouchableOpacity>

      <FlatList
        data={exercises}
        renderItem={renderItem}
        keyExtractor={(_, index) => index.toString()}
      />

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
  container: {},
  exerciseContainer: {
    marginBottom: 20,
  },
  exerciseName: {
    fontSize: 36,
    marginBottom: 10,
  },
  setInfo: {
    fontSize: 32,
    marginBottom: 5,
  },
});
