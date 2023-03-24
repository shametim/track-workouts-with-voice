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
import Timer from "./Timer";
import FileSize from "./FileSize";
import { IOSAudioQuality } from "expo-av/build/Audio/RecordingConstants";

SplashScreen.preventAutoHideAsync();

export default function App() {
  // https://twitter.com/DavidKPiano/status/1604870393084665856/photo/2
  const [recording, setRecording] = useState<Audio.Recording>();
  const [permission, setPermission] = useState<Audio.PermissionResponse>();
  const [exercises, setExercises] = useState([]);
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false);
  const [recordingSize, setRecordingSize] = useState(0);
  const [appIsReady, setAppIsReady] = useState(false);
  const [splashAnimation] = useState(new Animated.Value(1));
  const [recordingUri, setRecordingUri] = useState<string>();

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
    setExercises([]);
    // Ask or get permission from the user to use their device's microphone
    // to record the user's voice
    const permission = await Audio.requestPermissionsAsync();

    // Store the permission in device memory so we (the app) can inform the user
    // on their set permission.
    // i.e. 'You previously denied permission. Please check your settings.'
    setPermission(permission);

    setIsTimerActive(true);
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });

    const { recording } = await Audio.Recording.createAsync({
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
      ios: {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
        audioQuality: IOSAudioQuality.LOW,
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
    });

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

    setIsTimerActive(false);

    const uri = recording.getURI();
    if (typeof uri === "string") {
      setRecordingUri(uri);
      setRecording(undefined);

      // this is for testing locally
      // await transcribeAudio("assets/Recording.m4a");
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
      setRecordingSize(audioEncodedBytes.size);
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
  };

  if (!appIsReady) {
    return null;
  }

  interface Set {
    weight: number;
    unit: string;
    reps: number;
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

  return (
    <View onLayout={onLayoutRootView} style={styles.container}>
      <TouchableOpacity onPress={recording ? stopRecording : startRecording}>
        <Text style={{ fontFamily: "Dinish-Regular", fontSize: 64 }}>
          {recording ? "Stop Recording" : "Start Recording"}
        </Text>
      </TouchableOpacity>

      {Platform.OS === "ios" || Platform.OS === "android" ? (
        <FileSize fileUri={recordingUri} />
      ) : undefined}

      {Platform.OS === "web" ? (
        <Text style={{ fontSize: 32 }}>{recordingSize / 1024} KB</Text>
      ) : undefined}

      <Timer isActive={isTimerActive}></Timer>

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
  container: {
    // marginTop: 200,
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
