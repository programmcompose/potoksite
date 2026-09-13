# -*- coding: utf-8 -*-
"""
Генерация аудио-пар «до / после» для тестов этапа №2 (Сведение и VST Плагины).

Исходники берутся из реальных сэмплов проекта (docs/tools/frequency-map/samples,
docs/assets/audio), обрабатываются numpy/scipy и сохраняются в OGG:
    docs/tools/quiz/audio/etap2/*.ogg

Пары (A = исходник, B = обработанный вариант):
  eq-kick-*      кик-паттерн: полный спектр / срез низов (high-pass 150 Гц)
  eq-guitar-*    гитара: оригинал / lofi (low-pass ~3.2 кГц)
  comp-vocal-*   рэп-вокал: динамика / компрессия 4:1
  rev-melody-*   мелодическая фраза: dry / реверберация (хвост)
  dly-vocal-*    вокальная фраза: dry / делэй (dotted-eighth, фидбэк)
  chr-pad-*      пэд: оригинал / хорус (водянистый, наслоенный звук)
  sat-guitar-*   гитара: clean / сатурация-дисторшн (tanh drive)
  lim-loop-*     редкий драм-паттерн (кик/снейр/хэт): оригинал / лимитер
                 (makeup gain — громче и плотнее, «уплотнение пачки»)

Запуск (из корня репозитория):
    .tmp/quizgen/Scripts/python.exe Scripts/generate_quiz2_audio.py
(или любой python с numpy, scipy, soundfile; при отсутствии vorbis-кодека в
soundfile файлы сохраняются как WAV и их нужно сконвертировать ffmpeg'ом)

Файлы — ЗАГОТОВКИ: можно заменить своими записями из DAW, сохранив имена.
"""
import os
import subprocess
import numpy as np
import soundfile as sf
from scipy.signal import butter, lfilter, fftconvolve, resample_poly

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "tools", "quiz", "audio", "etap2")
os.makedirs(OUT, exist_ok=True)

RNG = np.random.default_rng(42)


# ---------------------------------------------------------------- helpers
def load(path):
    d, sr = sf.read(path)
    if d.ndim == 1:
        d = d[None, :]
    else:
        d = d.T  # (ch, n)
    return resample_to_sr(d, sr), SR


def resample_to_sr(x, sr):
    if sr == SR:
        return x
    g = np.gcd(sr, SR)
    return resample_poly(x, SR // g, sr // g).astype(np.float64)


def norm_peak(x, db=-3.0):
    p = float(np.abs(x).max())
    if p <= 1e-9:
        return x
    return x * (10 ** (db / 20.0)) / p


def rms(x):
    return float(np.sqrt((x ** 2).mean()))


def fade_edges(x, ms=8):
    n = max(1, int(SR * ms / 1000))
    f = np.linspace(0.0, 1.0, n) ** 2
    for c in range(x.shape[0]):
        x[c, :n] *= f
        if x.shape[1] > n:
            x[c, -n:] *= f[::-1]
    return x


def filter_x(x, fc, kind="low", order=4):
    b, a = butter(order, min(fc / (SR / 2), 0.99), kind)
    out = np.empty_like(x)
    for c in range(x.shape[0]):
        out[c] = lfilter(b, a, x[c])
    return out


def compressor(x, thresh_db=-18.0, ratio=4.0, release_ms=100.0):
    """Пиковый компрессор со stereo-link: пик-детектор (~1 мс) + медленный релиз.

    Gain падает мгновенно на пиках и восстанавливается медленно —
    поэтому эффект хорошо слышен (ровнее громкость, плотнее середина).
    """
    mono = x.mean(axis=0)
    env = np.abs(mono)
    a_fast = np.exp(-1.0 / max(2, SR * 1.0 / 1000))           # следим за пиками
    e = np.empty_like(env)
    ev = 0.0
    for i in range(len(env)):
        ev = max(env[i], ev * a_fast)
        e[i] = ev
    thresh = 10 ** (thresh_db / 20.0)
    over_db = np.maximum(20.0 * np.log10(np.maximum(e / thresh, 1e-9)), 0.0)  # dB выше порога
    target = 10 ** (-(over_db * (1.0 - 1.0 / ratio)) / 20.0)  # целевой gain (<= 1)
    a_rel = np.exp(-1.0 / max(2, SR * release_ms / 1000))
    g = np.empty_like(env)
    gv = target[0]
    for i in range(len(env)):
        if target[i] < gv:
            gv = target[i]                                    # сброс мгновенно
        else:
            gv = a_rel * gv + (1 - a_rel) * target[i]         # восстановление медленно
        g[i] = gv
    return x * g[None, :]


def tanh_drive(x, g=2.2):
    """Мягкий перегруз (tanh): добавляет нечётные гармоники и плотность."""
    y = np.tanh(g * x)
    # makeup: вернуть пик к уровню оригинала (слышна только разница в тембре)
    p1, p2 = float(np.abs(x).max()), float(np.abs(y).max())
    if p2 > 1e-9:
        y *= p1 / p2
    return y


def make_ir(decay_s=1.6, pre_ms=25):
    n = int(SR * decay_s)
    t = np.arange(n) / SR
    rate = -np.log(1e-3) / decay_s                 # хвост затухает до -60 dB
    ir = RNG.standard_normal(n) * np.exp(-rate * t)
    pre = int(SR * pre_ms / 1000)
    ir[:pre] = 0.0
    ir[pre:pre + 40] += RNG.standard_normal(40) * 2.0   # ранние отражения
    ir = filter_x(ir[None, :], 5500.0, "low", order=2)[0]
    return ir / np.abs(ir).max()


def reverb(x, wet=0.4):
    ir = make_ir()
    n = x.shape[1]
    out = x.copy()
    for c in range(x.shape[0]):
        conv = fftconvolve(x[c], ir)[:n]
        peak = float(np.abs(conv).max())
        if peak > 1e-9:
            out[c] += wet * (conv / peak) * 0.9
    return out


def feedback_delay(x, time_s=0.321, fb=0.45, mix=0.5):
    d = int(SR * time_s)
    n = x.shape[1]
    y = np.zeros_like(x)
    for c in range(x.shape[0]):
        buf = np.zeros(n + d)
        sig = x[c]
        for i in range(d, len(buf)):
            buf[i] = sig[i - d] + fb * buf[i - d]
        y[c] = (sig + mix * buf[:n]) / 1.0
    return y


def chorus(x):
    n = x.shape[1]
    t = np.arange(n) / SR
    out = x.copy()
    for c in range(x.shape[0]):
        src = x[c]
        v = np.zeros(n)
        for fc, center_ms, depth_ms in [(0.37, 21.0, 9.0), (0.53, 28.0, 12.0)]:
            delay_smp = (center_ms + depth_ms * np.sin(2 * np.pi * fc * t)) / 1000.0 * SR
            di = np.clip(np.floor(delay_smp).astype(int), 0, n - 1)
            fr = delay_smp - di
            idx0 = np.arange(n) - di
            valid = idx0 >= 0
            s0 = np.where(valid, src[np.clip(idx0, 0, n - 1)], 0.0)
            s1 = np.where(valid & (idx0 + 1 < n), src[np.clip(idx0 + 1, 0, n - 1)], 0.0)
            v += fr * s1 + (1 - fr) * s0
        out[c] += 0.35 * v
    return out


def save(name, x):
    """Записывает WAV и конвертирует в OGG (libvorbis) через ffmpeg."""
    x = np.clip(x, -0.999, 0.999)
    ogg = os.path.join(OUT, name)
    wav = ogg[:-4] + ".wav"
    sf.write(wav, x.T, SR)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", wav,
         "-c:a", "libvorbis", "-q:a", "6", ogg],
        check=True,
    )
    os.remove(wav)
    size_kb = os.path.getsize(ogg) / 1024
    print(f"  {name:<28} {x.shape[1]/SR:5.2f}s  peak={np.abs(x).max():.3f} rms={rms(x):.3f}  {size_kb:.0f} KB")


def seg(path, t0, t1):
    x, _ = load(path)
    a, b = int(t0 * SR), int(t1 * SR)
    return fade_edges(x[:, a:b].copy())


# ---------------------------------------------------------------- pairs
def build_drum_pattern():
    """Редкий драм-паттерн (2 такта, 140 BPM) из one-shot'ов проекта —
    с большими «дырами» между ударами: идеален для демо лимитера."""
    kick_raw, _ = load(os.path.join(ROOT, "docs/tools/frequency-map/samples/kick.ogg"))
    snare_raw, _ = load(os.path.join(ROOT, "docs/tools/frequency-map/samples/snare.ogg"))
    hat_raw, _ = load(os.path.join(ROOT, "docs/tools/frequency-map/samples/hihat.ogg"))
    kick = norm_peak(kick_raw, -6.0)
    snare = norm_peak(snare_raw, -6.0)
    hat = norm_peak(hat_raw, -8.0)
    beat = 60.0 / 140.0
    total = int((2 * 4 * beat + 0.6) * SR)
    pat = np.zeros((2, total))

    def place(one, t):
        s = int(t * SR)
        e = min(s + one.shape[1], total)
        if s < total:
            pat[:, s:e] += one[:, :e - s]

    for bar in range(2):
        b0 = bar * 4 * beat
        place(kick, b0)
        place(kick, b0 + 2 * beat)
        if bar == 1:
            place(kick, b0 + 3.5 * beat)      # синкопа во 2-м такте
        place(snare, b0 + beat)
        place(snare, b0 + 3 * beat)
        for i in range(8):
            place(hat, b0 + i * beat / 2)
    return pat


def main():
    print("== EQ: кик (срез низов)")
    kick, _ = load(os.path.join(ROOT, "docs/tools/frequency-map/samples/kick.ogg"))
    kick = norm_peak(kick, -6.0)
    beat = 60.0 / 140.0
    nbeats = 6
    total = int((nbeats * beat + 0.9) * SR)
    pat = np.zeros((kick.shape[0], total))
    for i in range(nbeats):
        s = int(i * beat * SR)
        pat[:, s:s + kick.shape[1]] += kick
    save("eq-kick-dry.ogg", norm_peak(pat, -3.0))
    save("eq-kick-hp.ogg", norm_peak(filter_x(pat, 150.0, "high"), -3.0))

    print("== EQ: гитара (lofi / срез высоких)")
    g = seg(os.path.join(ROOT, "docs/tools/frequency-map/samples/guitar_clean.ogg"), 1.0, 4.0)
    save("eq-guitar-dry.ogg", norm_peak(g, -3.0))
    lofi = filter_x(g, 3200.0, "low")
    save("eq-guitar-lofi.ogg", norm_peak(lofi, -3.0))

    print("== Compression: рэп-вокал")
    v = seg(os.path.join(ROOT, "docs/tools/frequency-map/samples/vocal_rap.ogg"), 0.15, 1.95)
    save("comp-vocal-dry.ogg", norm_peak(v, -3.0))
    comp = compressor(v, thresh_db=-9.0, ratio=6.0, release_ms=80.0)
    save("comp-vocal-comp.ogg", norm_peak(comp, -3.0))

    print("== Reverb: мелодическая фраза")
    m = seg(os.path.join(ROOT, "docs/tools/frequency-map/samples/synth_melody.ogg"), 0.0, 2.0)
    tail = int(1.5 * SR)
    mdry = np.pad(m, ((0, 0), (0, tail)))
    save("rev-melody-dry.ogg", norm_peak(mdry, -3.0))
    mrev = reverb(mdry, wet=0.42)
    save("rev-melody-rev.ogg", norm_peak(mrev, -3.0))

    print("== Delay: вокальная фраза")
    dv = seg(os.path.join(ROOT, "docs/tools/frequency-map/samples/vocal_rap.ogg"), 0.15, 1.0)
    dtail = int(1.7 * SR)
    ddry = np.pad(dv, ((0, 0), (0, dtail)))
    save("dly-vocal-dry.ogg", norm_peak(ddry, -3.0))
    ddel = feedback_delay(ddry, time_s=60 / 140 * 0.75, fb=0.42, mix=0.5)
    save("dly-vocal-delay.ogg", norm_peak(ddel, -3.0))

    print("== Chorus: пэд")
    p = seg(os.path.join(ROOT, "docs/tools/frequency-map/samples/synth_pad.ogg"), 2.8, 5.8)
    save("chr-pad-dry.ogg", norm_peak(p, -3.0))
    save("chr-pad-chorus.ogg", norm_peak(chorus(p), -3.0))

    print("== Saturation: гитара (clean / drive)")
    g2 = seg(os.path.join(ROOT, "docs/tools/frequency-map/samples/guitar_clean.ogg"), 5.5, 8.3)
    save("sat-guitar-clean.ogg", norm_peak(g2, -3.0))
    # пик совпадает с clean — слышна только разница в тембре (гармоники/плотность)
    save("sat-guitar-drive.ogg", tanh_drive(norm_peak(g2, -3.0), g=2.2))

    print("== Limiter: драм-паттерн (редкий, с «дырами»)")
    pat = build_drum_pattern()
    a = norm_peak(pat, -6.0)    # A: пик -6 dBFS, между ударами тишина
    save("lim-loop-orig.ogg", a)
    lim = compressor(pat, thresh_db=-8.0, ratio=20.0, release_ms=80.0)
    b = norm_peak(lim, -3.0)    # B: makeup после лимитера — громче и плотнее
    save("lim-loop-lim.ogg", b)

    print(f"\nГотово. Файлы: {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
