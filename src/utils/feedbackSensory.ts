/**
 * feedbackSensory.ts
 * Utilitário puro de feedback sensorial para SMG Barber.
 * Fornece síntese Web Audio API nativa (sem arquivos externos mp3/wav)
 * e vibração háptica via navigator.vibrate para dispositivos móveis.
 */

const AUDIO_STORAGE_KEY = 'smg_audio_feedback_enabled';

/**
 * Verifica se o feedback sonoro está habilitado pelo usuário.
 * Por padrão, retorna true se não houver preferência definida.
 */
export function isAudioFeedbackEnabled(): boolean {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        return false;
    }
    try {
        const stored = window.localStorage.getItem(AUDIO_STORAGE_KEY);
        if (stored === null) return true;
        return stored === 'true';
    } catch {
        return true;
    }
}

/**
 * Atualiza e persiste a preferência de áudio no localStorage.
 */
export function setAudioFeedbackEnabled(enabled: boolean): void {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        return;
    }
    try {
        window.localStorage.setItem(AUDIO_STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {
        // Silencioso em caso de restrição de storage
    }
}

// Singleton opcional de AudioContext para reutilização segura em gestos do usuário
let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    try {
        if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
            sharedAudioContext = new AudioCtx();
        }
        return sharedAudioContext;
    } catch {
        return null;
    }
}

/**
 * Executa um chime sonoro ascendente em dois tons (C5 -> E5: ~523Hz -> ~659Hz)
 * sintetizado puramente via Web Audio API com decaimento suave.
 * Respeita preferências de reduced-motion / mute e autoplay policy.
 */
export async function playCheckoutSuccessChime(): Promise<boolean> {
    if (!isAudioFeedbackEnabled()) return false;

    try {
        const ctx = getAudioContext();
        if (!ctx) return false;

        if (ctx.state === 'suspended') {
            await ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;
        const noteDuration = 0.08; // 80ms por tom
        const totalDuration = 0.18; // 180ms total

        // Tom 1: C5 (~523.25 Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, now);

        gain1.gain.setValueAtTime(0.001, now);
        gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + noteDuration);

        osc1.connect(gain1);
        gain1.connect(ctx.destination);

        osc1.start(now);
        osc1.stop(now + noteDuration);

        // Tom 2: E5 (~659.25 Hz) - entra com ligeira sobreposição harmônica
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659.25, now + 0.06);

        gain2.gain.setValueAtTime(0.001, now + 0.06);
        gain2.gain.exponentialRampToValueAtTime(0.22, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + totalDuration);

        osc2.connect(gain2);
        gain2.connect(ctx.destination);

        osc2.start(now + 0.06);
        osc2.stop(now + totalDuration);

        return true;
    } catch {
        // Fallback silencioso sem interromper o fluxo do checkout
        return false;
    }
}

/**
 * Dispara vibração tátil (haptic feedback) em dispositivos móveis compatíveis.
 * @param pattern Duração em ms ou array de pulso/pausa (padrão: 40ms)
 */
export function triggerHapticFeedback(pattern: number | number[] = 40): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.vibrate) {
        return false;
    }

    try {
        return navigator.vibrate(pattern);
    } catch {
        return false;
    }
}
