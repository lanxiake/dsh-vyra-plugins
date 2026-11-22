// Boundary entry for the Folia audio subsystem.
//
// Everything below this file is Folia's own source under `A_other/upstream`.
// This file only re-exports the parts the DSH plugin wires into its player;
// it must not grow its own DSP.

import { buildPlaybackGraph } from '../../A_other/upstream/folia-major-main/src/services/playbackGraph'
import {
  applyAudioEqualizerSettings,
  connectAudioEqualizerGraph,
  MOD_EQUALIZER_GLIDE_SECONDS,
  planAudioEqualizerApply,
} from '../../A_other/upstream/folia-major-main/src/services/audioEqualizerGraph'
import { createAudioEffectChain } from '../../A_other/upstream/folia-major-main/src/services/audioEffects/effectChain'
import {
  connectAutomixDeck,
  connectStemBus,
  connectStemDeck,
  rampGain,
  rampGainDb,
  resetThrow,
  resetTone,
  scheduleBandBlend,
  scheduleCrossfade,
  scheduleEchoThrow,
  scheduleStemWindow,
  softLimit,
} from '../../A_other/upstream/folia-major-main/src/services/automix/crossfadeGraph'
import { createDeckAnalyser } from '../../A_other/upstream/folia-major-main/src/services/automix/deckAnalyser'
import {
  BLEND_HEADROOM_DB,
  CROSSOVER_EARLY,
  CROSSOVER_LATE,
  MAX_TRIM_DB,
  buildBandCurves,
  buildCrossfadeCurves,
  crossoverFor,
  dbToGain,
  gatedLoudness,
  kWeightStep,
  planBlendShape,
  rmsDb,
  toneTilt,
  trimForBalance,
} from '../../A_other/upstream/folia-major-main/src/services/automix/signalAnalysis'
import { createBalanceMeter } from '../../A_other/upstream/folia-major-main/src/services/volumeBalance/balanceMeter'
import {
  chooseBalance,
  liftWithinPeak,
  planBalanceMove,
  typicalGainDb,
  whyNotWholePlay,
} from '../../A_other/upstream/folia-major-main/src/services/volumeBalance/balanceRules'
import {
  createPlaybackFadeController,
  PLAYBACK_FADE_SECONDS,
} from '../../A_other/upstream/folia-major-main/src/services/playbackFade'
import {
  AUDIO_EQUALIZER_BANDS,
  DEFAULT_AUDIO_EQUALIZER_SETTINGS,
  audioEqualizerBandShape,
  normalizeAudioEqualizerGains,
  resolveAudioEqualizerSettings,
} from '../../A_other/upstream/folia-major-main/src/utils/audioEqualizer'
import {
  AUDIO_EFFECT_CONTROLS,
  DEFAULT_AUDIO_EFFECT_SETTINGS,
  normalizeAudioEffects,
} from '../../A_other/upstream/folia-major-main/src/utils/audioEffects'
import {
  AUDIO_SOUND_PRESET_IDS,
  AUDIO_SOUND_PRESETS,
} from '../../A_other/upstream/folia-major-main/src/utils/audioPresets'

export {
  AUDIO_EQUALIZER_BANDS,
  AUDIO_EFFECT_CONTROLS,
  AUDIO_SOUND_PRESET_IDS,
  AUDIO_SOUND_PRESETS,
  BLEND_HEADROOM_DB,
  CROSSOVER_EARLY,
  CROSSOVER_LATE,
  DEFAULT_AUDIO_EFFECT_SETTINGS,
  DEFAULT_AUDIO_EQUALIZER_SETTINGS,
  MAX_TRIM_DB,
  MOD_EQUALIZER_GLIDE_SECONDS,
  PLAYBACK_FADE_SECONDS,
  applyAudioEqualizerSettings,
  audioEqualizerBandShape,
  buildBandCurves,
  buildCrossfadeCurves,
  buildPlaybackGraph,
  chooseBalance,
  connectAudioEqualizerGraph,
  connectAutomixDeck,
  connectStemBus,
  connectStemDeck,
  createAudioEffectChain,
  createBalanceMeter,
  createDeckAnalyser,
  createPlaybackFadeController,
  crossoverFor,
  dbToGain,
  gatedLoudness,
  kWeightStep,
  liftWithinPeak,
  normalizeAudioEffects,
  normalizeAudioEqualizerGains,
  planAudioEqualizerApply,
  planBalanceMove,
  planBlendShape,
  rampGain,
  rampGainDb,
  resetThrow,
  resetTone,
  resolveAudioEqualizerSettings,
  rmsDb,
  scheduleBandBlend,
  scheduleCrossfade,
  scheduleEchoThrow,
  scheduleStemWindow,
  softLimit,
  toneTilt,
  trimForBalance,
  typicalGainDb,
  whyNotWholePlay,
}
