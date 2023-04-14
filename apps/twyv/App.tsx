import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  Button,
  Text,
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
import { useRecorder } from "web-recorder";

import "expo-dev-client";

SplashScreen.preventAutoHideAsync();
let didInit = false;

const AUDIO_CONFIGURATION: Audio.RecordingOptions = {
  ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
  ios: {
    ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
    audioQuality: Audio.IOSAudioQuality.LOW,
    bitRate: 16000,
    sampleRate: 16000,
    numberOfChannels: 1,
  },
  android: {
    ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
    bitRate: 16000,
    sampleRate: 16000,
    numberOfChannels: 1,
  },
  web: { bitsPerSecond: 6000, mimeType: "audio/webm" },
  isMeteringEnabled: true,
};

interface Set {
  weight: number;
  unit: string;
  reps: number;
}
export default function App() {
  // https://twitter.com/DavidKPiano/status/1604870393084665856/photo/2
  const [isRecording, setIsRecording] = useState<boolean>(false);

  const [permission, setPermission] = useState<Audio.PermissionResponse>();
  const [exercises, setExercises] = useState([]);
  const [appIsReady, setAppIsReady] = useState(false);
  const [splashAnimation] = useState(new Animated.Value(1));
  const [transcription, setTranscription] = useState(undefined);

  const start = useRecorder({
    onReceiveAudioUrl: (url) => {
      fetch(url).then((e) => e);
    },
  });

  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync({
          "Dinish-Regular": require("./assets/fonts/Dinish-Regular.ttf"),
        });

        // await Audio.setAudioModeAsync({
        //   allowsRecordingIOS: true,
        //   playsInSilentModeIOS: true,
        //   staysActiveInBackground: true,
        // });

        // setPermission(await Audio.requestPermissionsAsync());

        // startRecording();
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

  async function startRecording(previous?: Audio.Recording) {
    if (previous) {
      await previous.stopAndUnloadAsync();
      uploadRecording(previous);

      if (!isRecording) {
        return;
      }
    }

    const { recording, status } = await Audio.Recording.createAsync(
      AUDIO_CONFIGURATION,
      (status) => {
        const loudness = status.metering;
      },
      500
    );

    await new Promise((resolve) => setTimeout(resolve, 5000));

    await startRecording(recording);
  }

  async function uploadRecording(recording: Audio.Recording) {
    const uri = recording.getURI();
    // const uri = "assets/Recording.m4a" // test with premade recording
    if (typeof uri === "string") {
      const formData = new FormData();

      if (Platform.OS === "ios" || Platform.OS === "android") {
        formData.append("file", {
          uri: uri,
          type: "audio/m4a",
          name: "recording.m4a",
        } as any);
        formData.append("model", "whisper-1");
      } else if (Platform.OS === "web") {
        const audioResponse = await fetch(uri);
        const audioEncodedBytes = await audioResponse.blob();
        formData.append("file", audioEncodedBytes, "recording.webm");
        formData.append("model", "whisper-1");
      }

      try {
        const url =
          Platform.OS === "web"
            ? "http://localhost:5000/transcribe"
            : "https://twyv.martinshameti.com/proxy";

        const response = await fetch(url, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        setTranscription(data.text);
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
      <Text
        style={{ fontFamily: "Dinish-Regular", fontSize: 24, color: "white" }}
      >
        {transcription}
      </Text>

      <FlatList
        data={exercises}
        renderItem={renderItem}
        keyExtractor={(_, index) => index.toString()}
      />

      <Button title="Record" onPress={start}></Button>

      {permission?.status === Audio.PermissionStatus.DENIED && (
        <Text>You previously denied mic permission</Text>
      )}

      {(Platform.OS === "ios" || Platform.OS === "android") &&
        permission?.status === Audio.PermissionStatus.DENIED && (
          <Button title="Open Settings" onPress={Linking.openSettings} />
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000000",
    width: "100%",
  },
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
