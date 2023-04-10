import React, { useState, useEffect } from "react";
import { View, Text } from "react-native";
import * as FileSystem from "expo-file-system";

interface Props {
  fileUri: string | undefined;
}

const FileSize: React.FC<Props> = ({ fileUri }) => {
  const [fileSize, setFileSize] = useState<number | null>(null);

  useEffect(() => {
    if (!fileUri) {
      return;
    }

    const getFileSize = async (): Promise<void> => {
      try {
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        setFileSize(fileInfo.size);
      } catch (error) {
        console.log(error);
      }
    };
    getFileSize();
  }, [fileUri]);

  return (
    <View>
      <Text>{fileSize ? `${fileSize / 1024} KB` : ""}</Text>
    </View>
  );
};

export default FileSize;
