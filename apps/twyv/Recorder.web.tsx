import React from "react";
import { Button } from "react-native";
import { useRecorder } from "web-recorder";

export function RecorderWeb(props) {
  // web only
  const start = useRecorder({
    onReceiveAudioUrl: (url) => {
      fetch(url).then((e) => e);
    },
  });
  return <Button title="Recorrrd" onPress={start}></Button>;
}
