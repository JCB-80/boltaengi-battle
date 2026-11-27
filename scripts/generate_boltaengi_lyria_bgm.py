"""
Google Flow / Lyria 9-Track Earworm Bakery Soundtrack Generator for Boltaengi Battle
Generates all 9 bespoke studio-mastered tracks (Lobby + 8 Bakery Maps) per @SPEC.md Section 3
with exact BPM lock, -12 LUFS commercial mastering, and 192kbps MP3 encoding via ffmpeg.
"""
import asyncio
import os
import subprocess
import wave
from google import genai
from google.genai import types

OUT_DIR = r"D:\boltaengi-battle\assets\bgm"
TMP_DIR = r"D:\lyria_boltaengi_tmp"
KEY_FILE = r"C:\Users\seo44\.gemini\antigravity\scratch\.gemini_api_key"

TRACKS = [
    ("lobby.mp3",          118, 60.0, "Bright cheerful French bakery morning pop, catchy whistling melody hook, bouncy acoustic guitar and marimba, upbeat handclaps, cute and addictive game lobby theme, 118 BPM, crystal clear mix"),
    ("bridge.mp3",         124, 60.0, "Sunny picnic march, ultra-catchy xylophone and glockenspiel main melody, warm pizzicato strings, playful snare bounce, happy casual game music, 124 BPM"),
    ("twin_peaks.mp3",     128, 60.0, "Upbeat Parisian gypsy jazz swing, playful accordion and clarinet melody hook, upright walking bass, crisp brush drums, sweet and breezy atmosphere, 128 BPM"),
    ("archipelago.mp3",    130, 60.0, "Bubbly cute Kawaii future pop instrumental, sparkling bell synth hook, groovy funk bassline, sweet strawberry party vibe, instantly memorable chorus melody, 130 BPM"),
    ("blueberry_tart.mp3", 126, 60.0, "Groovy upbeat funky disco pop, slap bass, cheerful brass stabs, catchy toy piano lead melody, energetic party game soundtrack, 126 BPM"),
    ("melon_soda.mp3",     120, 60.0, "Breezy pastel sky island theme, cheerful flute and celesta music box hook, light bouncy tropical percussion, dreamy yet upbeat catchy melody, 120 BPM"),
    ("honey_waffle.mp3",   136, 60.0, "Playful energetic ska brass band, staccato trumpet and trombone catchy riff, wooden marimba counter-melody, fun cartoon battle energy, 136 BPM"),
    ("matcha_cliff.mp3",   132, 60.0, "Bouncy electro swing, quirky muted trumpet melody, rubbery synth bass bounce, cheerful piano chords, super catchy rhythm, 132 BPM"),
    ("citadel.mp3",        140, 60.0, "Grand festive carnival big band pop, exciting brass fanfare hook, fast xylophone runs, celebratory parade drums, thrilling yet bright championship battle theme, 140 BPM"),
]


async def gen_track(client, fname, bpm, dur, prompt):
    os.makedirs(TMP_DIR, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    wav_path = os.path.join(TMP_DIR, fname.replace(".mp3", ".wav"))
    mp3_path = os.path.join(OUT_DIR, fname)

    sr, ch = 48000, 2
    target_bytes = int((dur + 1.0) * sr * ch * 2)
    pcm = bytearray()
    print(f"[LYRIA] {fname} ({bpm} BPM)...", flush=True)
    async with client.aio.live.music.connect(model="models/lyria-realtime-exp") as session:
        await session.set_weighted_prompts(prompts=[types.WeightedPrompt(text=prompt, weight=1.0)])
        await session.set_music_generation_config(
            config=types.LiveMusicGenerationConfig(bpm=bpm, density=0.76, brightness=0.84, guidance=4.5)
        )
        await session.play()
        async for msg in session.receive():
            sc = getattr(msg, "server_content", None)
            if sc and getattr(sc, "audio_chunks", None):
                for ck in sc.audio_chunks:
                    if ck.data:
                        pcm.extend(ck.data)
            if len(pcm) >= target_bytes:
                break
        await session.stop()

    with wave.open(wav_path, "wb") as wf:
        wf.setnchannels(ch)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm[:target_bytes])

    fade_out = max(0.0, dur - 1.2)
    subprocess.run([
        "ffmpeg", "-y", "-i", wav_path, "-t", str(dur),
        "-af", f"loudnorm=I=-12:TP=-1.0:LRA=7,afade=t=in:st=0:d=0.15,afade=t=out:st={fade_out:.2f}:d=1.2",
        "-ar", "44100", "-ac", "2", "-b:a", "192k", mp3_path
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"[OK] {fname} -> {os.path.getsize(mp3_path)/1024/1024:.2f} MB", flush=True)


async def main():
    with open(KEY_FILE, "r", encoding="utf-8") as f:
        api_key = f.read().strip()
    client = genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"})
    sem = asyncio.Semaphore(2)

    async def worker(t):
        async with sem:
            for attempt in range(1, 4):
                try:
                    await gen_track(client, *t)
                    return
                except Exception as e:
                    print(f"[RETRY {attempt}/3] {t[0]}: {e}", flush=True)
                    if attempt == 3:
                        raise
                    await asyncio.sleep(3 * attempt)

    await asyncio.gather(*(worker(t) for t in TRACKS))
    print("ALL_9_BOLTAENGI_BGM_DONE", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
