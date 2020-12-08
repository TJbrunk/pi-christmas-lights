
import React from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import './index.css';

// This is the framerate that the light sequence will run on the raspberry pi.
const FPS = 10;

// This is the number of lights that are connected.
const NUM_LIGHTS = 8;

// The number of bytes needed to represent a single frame.
const BYTES_PER_FRAME = Math.ceil(NUM_LIGHTS / 8);

// Number of frames before rotating the channels
const ROTATE_FRAMES = FPS;

// This is the IP address the raspberry pi is running at.
const PI_ADDRESS = 'http://192.168.1.5:3000';
// const PI_ADDRESS = 'http://192.168.1.2:3000';

class App extends React.Component {
  constructor() {
    super();
    this.ctx = new (window.AudioContext || window.webkitAudioContext);
    // const search = this.props.location.search;
    // const file = new URLSearchParams(search).get("file");
    this.state = {
      playing: false,
      lights: Array(NUM_LIGHTS).fill(false)
    };
    // get the file from the query parameters
    const regex = /file=(\w*)/gm;
    const str = window.location.toString();
    // const str = `http://localhost:3000/testlights.html?file=RichardSouther_CarolBells`;
    let m;
    let song = '';
    while ((m = regex.exec(str)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === regex.lastIndex) {
            regex.lastIndex++;
        }
        
        // The result can be accessed through the `m`-variable.
        m.forEach((match, groupIndex) => {
            console.log(`Found match, group ${groupIndex}: ${match}`);
        });
        song = m[1];
    }
  }

  async start() {
    // Play the audio using a live audio context
    this.source = this.ctx.createBufferSource();
    this.source.buffer = this.audioBuffer;
    this.source.connect(this.ctx.destination);
    this.source.start();

    // Simulate the light show on the screen.
    // This allows for easy testing and tweaking without going outside in the
    // freezing cold to watch the light show for real. 😜
    let fps = this.data[0];
    let data = this.data.slice(1);
    let interval = 1000 / fps;
    let lastFrame = -1;
    let startTime = Date.now();
    let LIGHTS = Array(NUM_LIGHTS).fill(0).map((_, i) => i);
    let onFrame = () => {
      // Decide which frame to show based on time
      let frame = Math.round((Date.now() - startTime) / interval);
      if (frame !== lastFrame) {
        lastFrame = frame;
        let idx = frame * BYTES_PER_FRAME;
        if (idx >= data.length) return;

        // Unpack light states from bits
        let lights = [];
        let index = 0;
        for (let j = 0; j < BYTES_PER_FRAME; j++) {
          let val = data[idx + j];
          for (let i = 0; i < 8 && index < NUM_LIGHTS; i++) {
            lights[LIGHTS[index++]] = Boolean((val >>> i) & 1);
          }
        }

        // Rotate the lights every few frames so the frequency channels move around
        if (frame % ROTATE_FRAMES === 0) {
          LIGHTS = [LIGHTS.pop(), ...LIGHTS];
        }    
        
        this.setState({lights});
      }

      this.frame = requestAnimationFrame(onFrame);
    };

    this.frame = requestAnimationFrame(onFrame);
  }

  async stop() {
    this.setState({playing: false});
    this.source.stop();
    cancelAnimationFrame(this.frame);
  }

  render() {
    return (
      <React.Fragment>
        {!this.state.playing 
          ? <button onClick={() => this.start()}>Play</button>
          : <button onClick={() => this.stop()}>Stop</button>
        }
        <div>
          {this.state.lights.map((light, i) => 
            <div key={i} className={classNames('light', {on: light})} />
          )}
        </div>
      </React.Fragment>
    );
  }
}

ReactDOM.render(<App />, document.getElementById('root'));
