// Copyright (c) 2022 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
import createUrlFromAudioBuffer from "./exporter";

export function createRecording({
  audioContext,
  microphone,
  onReceiveAudioUrl,
}: {
  audioContext: AudioContext;
  microphone: MediaStream;
  onReceiveAudioUrl: (audioUrl: string) => void;
}) {
  const micSourceNode = audioContext.createMediaStreamSource(microphone);

  const recordingProperties: {
    numberOfChannels: number;
    sampleRate: number;
    maxFrameCount: number;
  } = {
    numberOfChannels: micSourceNode.channelCount,
    sampleRate: audioContext.sampleRate,
    maxFrameCount: audioContext.sampleRate * 2, // 2 seconds maximum recording
  };

  const recordingNode = new AudioWorkletNode(
    audioContext,
    "recording-processor",
    {
      processorOptions: recordingProperties,
    }
  );

  let recordingLength = 0;

  recordingNode.port.onmessage = (event) => {
    if (event.data.message === "UPDATE_RECORDING_LENGTH") {
      recordingLength = event.data.recordingLength;
      console.log(recordingLength);
    } else if (event.data.message === "SHARE_RECORDING_BUFFER") {
      const recordingBuffer = audioContext.createBuffer(
        recordingProperties.numberOfChannels,
        recordingLength,
        audioContext.sampleRate
      );

      for (let i = 0; i < recordingProperties.numberOfChannels; i++) {
        recordingBuffer.copyToChannel(event.data.buffer[i], i, 0);
      }

      const wavUrl = createUrlFromAudioBuffer(recordingBuffer, false);

      onReceiveAudioUrl(wavUrl);
    }
  };

  micSourceNode.connect(recordingNode).connect(audioContext.destination);

  return recordingNode;
}
