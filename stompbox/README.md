# Stompbox Studio

A music maker that runs entirely in the browser: build tracks from boxes and cables, arrange a song, write lyrics, mix, perform live, analyze and remix songs. No server, no account; songs are kept in the visitor's own browser.

Open `index.html` through a web server (GitHub Pages is fine). Opening the file straight from disk (`file://`) won't load the recorded instruments.

## What's in this folder
- `index.html` – the whole app
- `samples/` – recorded instruments and drums (about 12 MB)
- `voice-engine.js` – the robot voice, loaded only when it's used
- `notes-engine.js` – the note finder used by "Analyze a song", loaded only when it's used

Tone.js, TensorFlow.js and ONNX Runtime load from the jsDelivr CDN.

## Splitting songs into instruments (optional)
"Analyze a song" works without anything extra. Its "Split into instruments" option (best results, and needed to keep the singer in a remix) uses the HT-Demucs 6-stem model (`htdemucs_6s.onnx`, about 285 MB). It's too big for a GitHub repository, so it isn't included: each person picks the file from their own computer once, and the browser keeps it.

## Credits and licences
- Piano, strings, harp, woodwinds, brass, marimba, glockenspiel: VSCO 2 Community Edition (CC0)
- Studio drum kit: Salamander Drumkit by Alexander Holm (public domain)
- Bass guitar, acoustic, nylon and electric guitar, organ, saxophone: tonejs-instruments by Nicholas Brosowsky (CC-BY 3.0), see `samples/*/LICENSE.txt`
- Robot voice: meSpeak.js / eSpeak (GNU GPL)
- Splitting: HT-Demucs by Meta AI (MIT), run with ONNX Runtime
- Note finding: Basic Pitch by Spotify (Apache 2.0), run with TensorFlow.js
- Sound engine: Tone.js (MIT)
