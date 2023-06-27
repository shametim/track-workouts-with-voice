import React from "react";
import { Button } from "react-native";
import { useRecorder } from "web-recorder";

export function RecorderWeb(props) {
  const start = useRecorder({
    onReceiveAudioUrl: (url) => {
      fetch(url).then((e) => e);
    },
  });

  return <Button title="Record" onPress={start}></Button>;
}
