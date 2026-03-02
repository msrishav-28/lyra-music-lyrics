export function createAnalyser(stream: MediaStream) {
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    return { ctx, analyser, source };
}

// Peak-pick on bass band (bins 0–12, ~20–250Hz)
export function detectBPM(analyser: AnalyserNode): number {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const bass = Array.from(data.slice(0, 12));
    const avg = bass.reduce((a, b) => a + b, 0) / bass.length;
    // Map avg energy (0–255) to BPM range (60–180)
    return Math.round(60 + (avg / 255) * 120);
}

export function getEnergyBands(analyser: AnalyserNode) {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);

    const avg = (arr: Uint8Array) =>
        Array.from(arr).reduce((a, b) => a + b, 0) / arr.length;

    return {
        bass: avg(data.slice(0, 10)),   // 20–200Hz
        mid: avg(data.slice(10, 100)),  // 200Hz–2kHz
        treble: avg(data.slice(100, 250)),  // 2kHz–5kHz
    };
}
