import React, { useState, useEffect } from "react";
import { Text } from "react-native";

interface Props {
  isActive: boolean;
}

const Timer: React.FC<Props> = ({ isActive }) => {
  const [timer, setTimer] = useState<number>(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive) {
      interval = setInterval(() => {
        setTimer((timer) => timer + 1);
      }, 1000);
    } else {
      setTimer(0);
    }

    return (): void => clearInterval(interval!);
  }, [isActive]);

  return <Text style={{ fontSize: 32 }}>{timer} sec</Text>;
};

export default Timer;
