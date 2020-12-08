const express = require('express');
const rpio = require('rpio');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const port = 3000;

console.log("Starting app");
// Configuration for light channels.
// This uses physical raspberry pi pin numbers, not GPIO numbers.
let LIGHTS = [
  {pin: 3, on: null}, // Candy Canes Bottom
  {pin: 5, on: null}, // Candy Canes Top
  {pin: 7, on: null}, // Icicles Right
  {pin: 8, on: null}, // Icicles Left
  {pin: 10, on: null}, // Icicles Garage
  {pin: 11, on: null}, // Stairs
  {pin: 12, on: null}, // Handrails
  {pin: 13, on: null},  // Tree
//  {pin: 15, on: null},
//  {pin: 16, on: null},
//  {pin: 18, on: null},
//  {pin: 19, on: null},
//  {pin: 21, on: null},
//  {pin: 22, on: null},
//  {pin: 23, on: null},
//  {pin: 24, on: null}
];

const BYTES_PER_FRAME = Math.ceil(LIGHTS.length / 8);

// Number of frames before rotating the channels
const ROTATE_FRAMES = 10;

// Initialize the pins for each light
for (let light of LIGHTS) {
  rpio.open(light.pin, rpio.OUTPUT);
}

let app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.raw({limit: '100mb'}));

// Play the provided light data
app.post('/play', async (req, res) => {
  console.log('handling POST request to /play');
  let data = req.body;
  console.log(data);

  await stop();

  // Delay for 1 second to allow the music to start on the remote device.
  // Send the time the lights will start to the client so it can sync.
  let startTime = Date.now() + 1000;
  res.send({startTime});

  await sleep(Date.now() - startTime);
  await start(data);
});

// Stop playing
app.post('/stop', async (req, res) => {
  console.log('handling POST request to /stop');
  await stop();
  res.sendStatus(200);
});

// Upload a file (either audio or light sequence data)
app.post('/upload', async (req, res) => {
  let data = req.body;
  let filename = req.header('X-Filename');

  console.log(`Handling uploaded file ${filename}`);
  fs.writeFileSync(path.join(__dirname, '..', 'audio', filename), data);
  res.send({success: true});
});

// List available audio files
app.get('/list', async (req, res) => {
  console.log('Getting list of uploaded files');
  let files = fs.readdirSync(path.join(__dirname, '..', 'audio')).filter(file => !file.endsWith('.bin') && !file.startsWith('.'));
  res.send({files});
});

// Get audio data
app.get('/audio/:filename', async (req, res) => {
  console.log(`Getting audio file: ${req.params.filename}`);
  res.sendFile(path.join(__dirname, '..', 'audio', req.params.filename));
});

// Play the light sequence for a specific file
app.get('/play/:filename', async (req, res) => {
  console.log(`Playing file ${req.params.filename}`);

  let data = fs.readFileSync(path.join(__dirname, '..', 'audio', req.params.filename + '.bin'));
  await stop();

  // Delay for 1 second to allow the music to start on the remote device.
  // Send the time the lights will start to the client so it can sync.
  let startTime = Date.now() + 1000;
  res.send({startTime});

  await sleep(Date.now() - startTime);
  await start(data);
});

// Serve static files for the UI
app.use(express.static('dist'));

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function play(data) {
  // Read framerate from data
  let fps = data[0];
  let frameInterval = Math.floor(1000 / fps);

  data = data.slice(1);
  let numFrames = Math.floor(data.length / BYTES_PER_FRAME);

  let frameIndex = 0;
  while (frameIndex < numFrames) {
    if (!playing) {
      break;
    }

    let frameStart = Date.now();
    let idx = frameIndex * BYTES_PER_FRAME;

    // Light status for a frame is packed into bits
    let index = 0;
    for (let j = 0; j < BYTES_PER_FRAME; j++) {
      let val = data[idx + j];
      for (let i = 0; i < 8 && index < LIGHTS.length; i++) {
        let light = LIGHTS[index++];
        let on = Boolean((val >>> i) & 1);
        if (light.on === on) {
          continue;
        }
  
        rpio.write(light.pin, on ? rpio.HIGH : rpio.LOW);
        light.on = on;
      }
    }

    // Rotate the lights every few frames so the frequency channels move around
    if (frameIndex % ROTATE_FRAMES === 0) {
      LIGHTS = [LIGHTS.pop(), ...LIGHTS];
    }

    frameIndex++;
    
    // Compute the time it took to process this frame, and sleep for the remaining frame duration
    let writeTime = Date.now() - frameStart;
    await sleep(frameInterval - writeTime);
  }
}

let playing = false;
let playPromise = null;

function start(data) {
  // If already playing, queue up the next song.
  // Otherwise, play immediately
  if (playPromise) {
    playPromise = playPromise.then(() => play(data));
  } else {
    playing = true;
    playPromise = play(data);
  }

  return playPromise;
}

function stop() {
  if (!playing) {
    return;
  }

  playing = false;
  return playPromise.then(() => {
    playPromise = null;
  });
}

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
