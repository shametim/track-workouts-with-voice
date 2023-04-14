import { useEffect, useState } from "react";
import { createRecording } from "./audio-worklet/audio-context";

export function useRecorder({
  onReceiveAudioUrl,
}: {
  onReceiveAudioUrl: (audioUrl: string) => void;
}) {
  const [isRecording, setIsRecording] = useState<boolean>();
  const [isProcessorImported, setIsProcessorImported] = useState<boolean>();
  const [microphone, setMicrophone] = useState<MediaStream>();
  const [audioContext, setAudioContext] = useState<AudioContext>();

  useEffect(() => {
    if (audioContext?.state === "suspended") {
      audioContext.resume();
    }

    if (!isProcessorImported && audioContext?.state === "running") {
      audioContext.audioWorklet
        .addModule("./packages/web-recorder/dist/recording-processor.js")
        .then(() => setIsProcessorImported(true));
    }
  }, [audioContext?.state, isProcessorImported]);

  useEffect(() => {
    if (
      isRecording ||
      audioContext?.state !== "running" ||
      microphone?.active !== true
    ) {
      return;
    }

    const recording = createRecording({
      audioContext,
      microphone,
      onReceiveAudioUrl,
    });

    setIsRecording(true);
    recording.port.postMessage({
      message: "UPDATE_RECORDING_STATE",
      setRecording: true,
    });

    return () => {
      recording.port.postMessage({
        message: "UPDATE_RECORDING_STATE",
        setRecording: false,
      });
      recording.disconnect();
    };
  }, [audioContext?.state, microphone?.active]);

  // useEffect(() => {
  //   function onInterval() {
  //     recording.port.postMessage({
  //       message: "SHARE_RECORDING_BUFFER",
  //       setRecording: true,
  //     });
  //   }
  //   const intervalId = setInterval(onInterval, 5000);

  //   return () => {
  //     clearInterval(intervalId);
  //   };
  // }, [isRecording]);

  return function startRecording() {
    setAudioContext(new AudioContext());
    navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
          // @ts-ignore: https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints
          latency: 0,
        },
      })
      .then((mic) => setMicrophone(mic));
  };
}
