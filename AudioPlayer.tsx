import React, { useEffect, useState } from "react";
import { Platform, View, Button } from "react-native";
import { Audio } from "expo-av";

interface Props {
  recordingUri: string | undefined;
}

const AudioPlayer: React.FC<Props> = ({ recordingUri }) => {
  const [sound, setSound] = useState<Audio.Sound>();

  useEffect(() => {
    if (recordingUri) {
      const fetchRecording = async () => {
        const { sound } = await Audio.Sound.createAsync({
          uri: recordingUri,
        });
        setSound(sound);
      };

      fetchRecording();
    }
  }, [recordingUri]);

  return (
    <>
      {Platform.OS === "web" && typeof recordingUri === "string" && (
        <audio controls>
          <source src={recordingUri} type="audio/mpeg" />
          Your browser does not support the audio tag.
        </audio>
      )}

      {(Platform.OS === "ios" || Platform.OS === "android") &&
        typeof sound !== "undefined" && (
          <View>
            <Button
              title="Play"
              onPress={() => {
                sound?.playAsync();
              }}
            />
            <Button
              title="Stop"
              onPress={() => {
                sound?.stopAsync();
              }}
            />
          </View>
        )}
    </>
  );
};

export default AudioPlayer;
