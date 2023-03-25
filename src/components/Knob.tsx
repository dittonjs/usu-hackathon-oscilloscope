import { useEffect, useState } from "react";

type KnobProps = {
  label: string;
  min: number;
  max: number;
  value: number;
  setValue?: React.Dispatch<React.SetStateAction<number>>
}

export const Knob = ({label, min, max, value, setValue = () => {}}: KnobProps) => {
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [y, setY] = useState(0);
  console.log("WHAT IS MY VALUE", value);
  useEffect(() => {
    function adjust(e: MouseEvent) {
      const delta = -(e.clientY - y);
      let amount =  delta / 150;
      setValue((v) => {
        const newValue = v + (amount * (max - min));
        console.log(newValue,  "is my new value")
        if (newValue > max) return max;
        if (newValue < min) return min;
        return newValue;
      });
      setY(e.clientY);
    }

    function stop() { setIsAdjusting(false); }

    if (isAdjusting) {
      window.addEventListener('mousemove', adjust);
      window.addEventListener('mouseup', stop);
    }

    return () => {
      window.removeEventListener('mousemove', adjust);
      window.removeEventListener('mouseup', stop);
    }
  }, [isAdjusting, y]);

  const rotationPercentage = (value - min) / ((max - min));
  const rotation = (rotationPercentage * 270) - 135;

  return (
    <div className="knob-container" >
      <span className="dont-select">{label}</span>
      <span className="min">{min}</span>
      <span className="max">{max}</span>
      <div
        className="knob"
        onMouseDown={(e) => {
          setIsAdjusting(true);
          setY(e.clientY)
        }}
        style={{
          transform: `rotateZ(${rotation}deg)`
        }}
      >
        <div className="inner-knob"></div>
        <span className="material-icons">arrow_drop_up</span>
      </div>
    </div>
  )
}