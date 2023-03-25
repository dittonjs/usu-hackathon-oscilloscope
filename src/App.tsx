import { SetStateAction, useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Knob } from './components/Knob';
import { findNLargestValues } from './lib/findLargestNValues';
import WhiteNoiseWorklet from "./lib/WhiteNoiseWorklet.js?url";

const NOTES = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];

function noteFromPitch( frequency: number ) {
	var noteNum = 12 * (Math.log( frequency / 440 )/Math.log(2) );
	return Math.round( noteNum ) + 69;
}


function App() {
  const [source, setSource] = useState("line");
  const [frequency, setFrequency] = useState(440.0);
  const [sampleSize, setSampleSize] = useState("2048");
  const sampleSizeRef = useRef(parseInt(sampleSize));
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [context] = useState<AudioContext>(() => new AudioContext());
  const [isSetup, setIsSetup] = useState(false);
  const [analyzerNode] = useState(() => new AnalyserNode(context, {fftSize: 32768}));
  const [gainNode] = useState(() => new GainNode(context, { gain: 1 }))
  const [gain, setGain] = useState(1);
  const [width, setWidth] = useState(document.body.clientWidth -32);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContextRef = useRef<CanvasRenderingContext2D | null | undefined>(null);
  const canvasFrequencyRef = useRef<HTMLCanvasElement>(null);
  const canvasFrequencyContextRef = useRef<CanvasRenderingContext2D | null | undefined>();
  const dataArrayRef = useRef(new Uint8Array(analyzerNode.fftSize));
  const frequencyDataArrayRef = useRef(new Float32Array(analyzerNode.frequencyBinCount))
  const audioSourceRef = useRef<AudioNode>()

  // draw the canvas NO STATE!
  const draw = useCallback(() => {
    if (runningRef.current) requestAnimationFrame(draw);
    if (!canvasContextRef.current) { return };
    analyzerNode.getByteTimeDomainData(dataArrayRef.current)
    const width = canvasRef.current!!.width;
    const height = canvasRef.current!!.height;
    const bufferLength = analyzerNode.fftSize;
    canvasContextRef.current.clearRect(0, 0, width, height);

    canvasContextRef.current.lineWidth = 2;
    canvasContextRef.current.strokeStyle = "rgb(0, 0, 0)";

    const sliceWidth = (width) / bufferLength;
    let x = 0;

    canvasContextRef.current.beginPath();
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArrayRef.current[i] / 128;
      const y = (v * height) / 2;

      if (i === 0) {
        canvasContextRef.current.moveTo(x, y);
      } else {
        canvasContextRef.current.lineTo(x, y);
      }

      x += sliceWidth;
    }



    canvasContextRef.current.lineTo(width, height / 2);
    canvasContextRef.current.stroke();
  }, []);

  const drawFrequencies = useCallback(() => {
    if (runningRef.current) requestAnimationFrame(drawFrequencies);
    if (!canvasFrequencyContextRef.current) { return };
    analyzerNode.getFloatFrequencyData(frequencyDataArrayRef.current);
    const width = canvasFrequencyRef.current!!.width;
    const height = canvasFrequencyRef.current!!.height;
    canvasFrequencyContextRef.current.clearRect(0,0,width, height);
    const bufferLength = (analyzerNode.frequencyBinCount) / Math.log2(sampleSizeRef.current);

    const largestIndexes = findNLargestValues(3, frequencyDataArrayRef.current);
    canvasFrequencyContextRef.current.font = '20px Arial'
    canvasFrequencyContextRef.current.fillText(`Dominant Frequency: ${(48000 / 2 / analyzerNode.frequencyBinCount) * largestIndexes[0]}Hz`, 50, 50);
    const startIndex = Math.floor(100 / (48000 / 2 / analyzerNode.frequencyBinCount)) + 1
    //Draw spectrum
    const barWidth = (width / (bufferLength - startIndex)) * 2.5;
    let posX = 0;
    let lastNote = '';
    for (let i = startIndex; i < bufferLength; i++) {
      const barHeight = (frequencyDataArrayRef.current[i] + 140) * 2;
      canvasFrequencyContextRef.current.fillStyle = `rgb(100, 50, ${Math.floor(barHeight + 100)})`;
      canvasFrequencyContextRef.current.fillRect(
        posX,
        height - barHeight / 2,
        barWidth,
        barHeight / 2
      );
      const note = noteFromPitch((48000 / 2 / analyzerNode.frequencyBinCount) * i);
      const noteName = NOTES[note%12];
      if (noteName && noteName !== lastNote) {
        let shift = 8;
        if (sampleSizeRef.current > 8000) {
          shift = 16;
        }
        if (sampleSizeRef.current > 16000) {
          shift = 18;
        }
        if (sampleSizeRef.current > 32000) {
          shift = 22;
        }
        canvasFrequencyContextRef.current.font = '12px Arial'
        canvasFrequencyContextRef.current.fillText(noteName, posX + shift, 100);
        lastNote = noteName;
      }

      posX += barWidth + 1;
    }
  }, []);

  async function setup() {
    console.log("When am I called?")
    // await context.audioWorklet.addModule(WhiteNoiseWorklet);
    let audioSource: AudioNode;
    if (source === 'line') {
      const stream = await navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
          latency: 0,
          // channelCount: 2
        }
      });
      audioSource = context.createMediaStreamSource(stream);

    } else if(source === "sine" || source === "square" || source === "sawtooth" || source === "triangle") {
      const osc = context.createOscillator();
      osc.type = source;
      osc.start();
      audioSource = osc;
    }
    audioSourceRef.current = audioSource!!

    audioSource!!
    .connect(gainNode)
    .connect(analyzerNode)
    // .connect(splitter)
    // // //route output 0 (left) from the splitter to input 1 (right) on the merger. This is a mono connection as well, carrying the left output signal to the right input of the Merger.
    // .connect(merger, 0, 1)
    //route output 0 (left) from the splitter to input 0 (left) on the merger. This is a mono connection, carrying the left output signal to the left input of the Merger.
    // .connect(whiteNoiseNode)
    .connect(context.destination)
  }

  async function start() {
    setRunning(true);
  }

  async function stop() {
    setRunning(false);
  }

  useEffect(() => {
    if (running) {
      canvasContextRef.current = canvasRef.current?.getContext("2d");
      canvasFrequencyContextRef.current = canvasFrequencyRef.current?.getContext("2d");
      runningRef.current = true;
      draw();
      drawFrequencies();
      if (!isSetup) {
        setIsSetup(true);
        setup().then(() => context.resume())
      } else {
        context.resume()
      }
    } else if (isSetup) {
      runningRef.current = false;
      context.suspend();
    }
  }, [running]);

  useEffect(() => {
    window.onresize = () => {
      setWidth(document.body.clientWidth - 32);
    }
  }, [])

  useEffect(() => {
    sampleSizeRef.current = parseInt(sampleSize);
    analyzerNode.fftSize = sampleSizeRef.current;
  }, [sampleSize])

  useEffect(() => {
    gainNode.gain.value = gain
  }, [gain]);

  useEffect(() => {
    if (audioSourceRef.current && audioSourceRef.current instanceof OscillatorNode) {
      (audioSourceRef.current as OscillatorNode).frequency.value = frequency;
    }
  }, [frequency])

  console.log("log", Math.log2(frequency))

  return (
    <div className="container">
      <div className="controls">
        <select
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setRunning(false);
            setIsSetup(false);
            context.destination.disconnect();
            analyzerNode.disconnect();
            gainNode.disconnect();
            audioSourceRef.current?.disconnect();
            context.suspend();
          }}
        >
          <option value="line">Line In</option>
          <option value="sine">Sine Wave</option>
          <option value="square">Square Wave</option>
          <option value="sawtooth">Saw Wave</option>
          <option value="triangle">Triangle Wave</option>
        </select>
        <select
          value={sampleSize}
          onChange={(e) => {
            setSampleSize(e.target.value)
          }}
        >
          <option value="2048">2048</option>
          <option value="4096">4096</option>
          <option value="8192">8192</option>
          <option value="16384">16384</option>
          <option value="32768">32768</option>
        </select>
        <button onClick={() => running ? stop() : start()}>
          {running ? "Stop" : "Start"}
        </button>
      </div>
      <h2>Time Domain</h2>
      <canvas width={`${width}`} height="250" className="oscilloscope" ref={canvasRef}></canvas>
      <h2>Frequency Domain</h2>
      <canvas width={`${width}`} height="250" className="frequency" ref={canvasFrequencyRef}></canvas>
      <div className="flex">
        <Knob label="GAIN" min={0} max={10} value={gain} setValue={setGain}/>
        {
          source !== "line" && (
            <Knob
              label="FREQUENCY"
              min={6}
              max={14}
              value={Math.log2(frequency)}
              setValue={(callback: any) => {
                  setFrequency((v) => {
                    const cpv = callback(v);
                    const result = Math.pow(2, callback(Math.log2(v)));
                    return result;
                  })
              }}/>
          )
        }
      </div>
    </div>
  )
}

export default App
