import React, { useState, useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Audio } from "expo-av";

export default function App() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  async function startRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync();
      await newRecording.startAsync();
      setRecording(newRecording);
    } catch (error) {
      console.log("Failed to start recording", error);
    }
  }

  async function stopRecording() {
    try {
      if (!recording) {
        return;
      }
      await recording.stopAndUnloadAsync();
      const uri = JSON.stringify(recording.getURI());

      const response = await fetch("https://example.com/api/recordings", {
        method: "POST",
        body: uri,
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Recording uploaded", data);
    } catch (error) {
      console.log("Failed to stop recording", error);
    } finally {
      setRecording(null);
    }
  }

  useEffect(() => {
    if (recording) {
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
    } else {
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
    }
  }, [recording]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={recording ? stopRecording : startRecording}
      >
        <Text style={styles.buttonText}>
          {recording ? "Stop Recording" : "Start Recording"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#00aaff",
    padding: 20,
    borderRadius: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});
