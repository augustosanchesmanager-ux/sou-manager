import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    isAudioFeedbackEnabled,
    setAudioFeedbackEnabled,
    playCheckoutSuccessChime,
    triggerHapticFeedback
} from './feedbackSensory';

describe('feedbackSensory', () => {
    let mockStorage: Record<string, string> = {};

    beforeEach(() => {
        mockStorage = {};
        vi.restoreAllMocks();

        // Configuração de ambiente global de navegador
        const storageMock = {
            getItem: vi.fn((key: string) => mockStorage[key] ?? null),
            setItem: vi.fn((key: string, val: string) => {
                mockStorage[key] = val;
            }),
            removeItem: vi.fn((key: string) => {
                delete mockStorage[key];
            }),
            clear: vi.fn(() => {
                mockStorage = {};
            })
        };

        Object.defineProperty(globalThis, 'window', {
            value: {
                localStorage: storageMock
            },
            configurable: true,
            writable: true
        });

        Object.defineProperty(globalThis, 'navigator', {
            value: {},
            configurable: true,
            writable: true
        });
    });

    afterEach(() => {
        mockStorage = {};
    });

    describe('isAudioFeedbackEnabled & setAudioFeedbackEnabled', () => {
        it('should default to true if localStorage has no setting', () => {
            expect(isAudioFeedbackEnabled()).toBe(true);
        });

        it('should set audio feedback to false and persist in localStorage', () => {
            setAudioFeedbackEnabled(false);
            expect(mockStorage['smg_audio_feedback_enabled']).toBe('false');
            expect(isAudioFeedbackEnabled()).toBe(false);
        });

        it('should set audio feedback to true and persist in localStorage', () => {
            setAudioFeedbackEnabled(false);
            setAudioFeedbackEnabled(true);
            expect(mockStorage['smg_audio_feedback_enabled']).toBe('true');
            expect(isAudioFeedbackEnabled()).toBe(true);
        });
    });

    describe('triggerHapticFeedback', () => {
        it('should call navigator.vibrate with given pattern if supported', () => {
            const mockVibrate = vi.fn().mockReturnValue(true);
            Object.defineProperty(navigator, 'vibrate', {
                value: mockVibrate,
                configurable: true,
                writable: true
            });

            const result = triggerHapticFeedback(50);
            expect(mockVibrate).toHaveBeenCalledWith(50);
            expect(result).toBe(true);
        });

        it('should use default 40ms pattern if none provided', () => {
            const mockVibrate = vi.fn().mockReturnValue(true);
            Object.defineProperty(navigator, 'vibrate', {
                value: mockVibrate,
                configurable: true,
                writable: true
            });

            const result = triggerHapticFeedback();
            expect(mockVibrate).toHaveBeenCalledWith(40);
            expect(result).toBe(true);
        });

        it('should return false gracefully if navigator.vibrate is undefined', () => {
            Object.defineProperty(navigator, 'vibrate', {
                value: undefined,
                configurable: true,
                writable: true
            });

            const result = triggerHapticFeedback();
            expect(result).toBe(false);
        });
    });

    describe('playCheckoutSuccessChime', () => {
        it('should return false immediately if audio is disabled', async () => {
            setAudioFeedbackEnabled(false);
            const result = await playCheckoutSuccessChime();
            expect(result).toBe(false);
        });

        it('should synthesize two notes via Web Audio API if supported and enabled', async () => {
            setAudioFeedbackEnabled(true);

            const mockSetValueAtTime = vi.fn();
            const mockExponentialRamp = vi.fn();
            const mockConnect = vi.fn();
            const mockStart = vi.fn();
            const mockStop = vi.fn();

            const mockCreateOscillator = vi.fn().mockImplementation(() => ({
                type: 'sine',
                frequency: { setValueAtTime: mockSetValueAtTime },
                connect: mockConnect,
                start: mockStart,
                stop: mockStop
            }));

            const mockCreateGain = vi.fn().mockImplementation(() => ({
                gain: {
                    setValueAtTime: mockSetValueAtTime,
                    exponentialRampToValueAtTime: mockExponentialRamp
                },
                connect: mockConnect
            }));

            const mockResume = vi.fn().mockResolvedValue(undefined);

            class MockAudioContext {
                state = 'suspended';
                currentTime = 10;
                destination = {};
                createOscillator = mockCreateOscillator;
                createGain = mockCreateGain;
                resume = mockResume;
            }

            Object.defineProperty(window, 'AudioContext', {
                value: MockAudioContext,
                configurable: true,
                writable: true
            });

            const result = await playCheckoutSuccessChime();

            expect(result).toBe(true);
            expect(mockResume).toHaveBeenCalled();
            expect(mockCreateOscillator).toHaveBeenCalledTimes(2);
            expect(mockCreateGain).toHaveBeenCalledTimes(2);
            expect(mockStart).toHaveBeenCalledTimes(2);
            expect(mockStop).toHaveBeenCalledTimes(2);
        });
    });
});
