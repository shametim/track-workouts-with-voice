import React, { useState, useEffect, useRef } from "react";
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
import { streamAudio } from "./streaming-http2";
import { RecorderWeb } from "./Recorder.web";
import * as FileSystem from "expo-file-system";

import { AppState } from "react-native";
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
  web: { bitsPerSecond: 16000, mimeType: "audio/webm" },
  isMeteringEnabled: true,
};

interface Set {
  weight: number;
  unit: string;
  reps: number;
}

export default function App() {
  const [isRecording, setIsRecording] = useState<boolean>(true);

  const [permission, setPermission] = useState<Audio.PermissionResponse>();
  const [exercises, setExercises] = useState([]);
  const [appIsReady, setAppIsReady] = useState(false);
  const [splashAnimation] = useState(new Animated.Value(1));
  const [transcription, setTranscription] = useState(undefined);
  const recordingUri = useRef<string>();
  const appState = useRef(AppState.currentState);
  const position = useRef(0);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync({
          "Dinish-Regular": require("./assets/fonts/Dinish-Regular.ttf"),
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

  const onLayoutRootView = async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
      Animated.timing(splashAnimation, {
        toValue: 0,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }
  };

  useEffect(() => {
    async function record() {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      setPermission(await Audio.requestPermissionsAsync());

      const { recording } = await Audio.Recording.createAsync(
        AUDIO_CONFIGURATION,
        onRecording,
        1000
      );

      recordingUri.current = recording.getURI();

      try {
        if (Platform.OS === "ios" || Platform.OS === "android") {
          startRecordingWithFileStreaming(recording);
        }
      } catch (e) {
        console.log(e.message);
      }
    }

    record();
  }, []);

  async function startRecording() {
    let voiceDetected = undefined;

    const { recording } = await Audio.Recording.createAsync(
      AUDIO_CONFIGURATION,
      (status) => {
        const loudness = status.metering;
        if (loudness > -30) {
          voiceDetected = true;
        }
      },
      500
    );

    await recording.stopAndUnloadAsync();

    if (voiceDetected) {
      uploadRecording(recording);

      voiceDetected = false;
    }

    if (!isRecording) {
      return;
    }

    await startRecording();
  }

  async function onRecording(status: Audio.RecordingStatus) {
    if (
      status.isRecording &&
      Platform.OS === "android" &&
      recordingUri.current
    ) {
      const meta = await FileSystem.getInfoAsync(recordingUri.current, {
        size: true,
      });
      console.log(
        "current: ",
        position.current,
        "  size: ",
        meta["size"],
        " diff: ",
        meta["size"] - position.current
      );
      if (position.current === meta["size"]) {
      } else {
        const content = await FileSystem.readAsStringAsync(
          recordingUri.current,
          {
            encoding: "base64",
            position: position.current,
            length: meta["size"],
          }
        );
        position.current = meta["size"];
        console.log(content.length);
      }
    }
  }

  async function startRecordingWithFileStreaming(recording: Audio.Recording) {
    const status = await recording.getStatusAsync();
    let position = 0;
    let length = 0;

    const audioFrameLength = 1000; // 1000 ms = 1 second

    while (status.isRecording) {
      const recordingMetadata = await FileSystem.getInfoAsync(
        recording.getURI(),
        { size: true }
      );
      const recordedBytesSoFar: number = recordingMetadata["size"];

      const recordingBinary = await FileSystem.readAsStringAsync(
        recording.getURI(),
        { encoding: "base64", position, length: recordedBytesSoFar }
      );

      const data = await uploadForNativeApps(recordingBinary);
      await new Promise((resolve) => setTimeout(resolve, audioFrameLength));

      position = recordedBytesSoFar;
      length += recordedBytesSoFar;
    }
  }

  function uploadForNativeApps(binary: string) {
    // const formData = new FormData();
    // const fileBlob = new Blob([binary], { type: "application/octet-stream" });
    // formData.append("file", fileBlob, "recording.bin");
    return fetch("https://twyv.martinshameti.com/upload-binary-body", {
      method: "POST",
      body: binary,
    });
  }

  async function uploadRecording(recording: Audio.Recording) {
    // const uri = recording.getURI();
    const uri = "assets/Recording.m4a"; // test with premade recording
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

      {Platform.OS === "web" && <RecorderWeb></RecorderWeb>}

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
