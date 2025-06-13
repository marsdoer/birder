/*
Repl.jsx - REPL component for Strudel with custom code on load
Copyright (C) 2022 Strudel contributors
License: GNU Affero GPLv3 or later
*/

import { code2hash, getPerformanceTimeSeconds, logger, silence } from '@strudel/core';
import { getDrawContext } from '@strudel/draw';
import { transpiler } from '@strudel/transpiler';
import {
  getAudioContextCurrentTime,
  webaudioOutput,
  resetGlobalEffects,
  resetLoadedSounds,
  initAudioOnFirstClick,
} from '@strudel/webaudio';
import { setVersionDefaultsFrom } from './util.mjs';
import { StrudelMirror, defaultSettings } from '@strudel/codemirror';
import { clearHydra } from '@strudel/hydra';
import { useCallback, useEffect, useRef, useState } from 'react';
import { parseBoolean, settingsMap, useSettings } from '../settings.mjs';
import {
  setActivePattern,
  setLatestCode,
  createPatternID,
  userPattern,
  getViewingPatternData,
  setViewingPatternData,
} from '../user_pattern_utils.mjs';
import { superdirtOutput } from '@strudel/osc/superdirtoutput';
import { audioEngineTargets } from '../settings.mjs';
import { useStore } from '@nanostores/react';
import { prebake } from './prebake.mjs';
import { getRandomTune, initCode, loadModules, shareCode } from './util.mjs';
import './Repl.css';
import { setInterval, clearInterval } from 'worker-timers';
import { getMetadata } from '../metadata_parser';

const { maxPolyphony, audioDeviceName, multiChannelOrbits } = settingsMap.get();
let modulesLoading, presets, drawContext, clearCanvas, audioReady;

if (typeof window !== 'undefined') {
  audioReady = initAudioOnFirstClick({
    maxPolyphony,
    audioDeviceName,
    multiChannelOrbits: parseBoolean(multiChannelOrbits),
  });
  modulesLoading = loadModules();
  presets = prebake();
  drawContext = getDrawContext();
  clearCanvas = () => drawContext.clearRect(0, 0, drawContext.canvas.height, drawContext.canvas.width);
}

async function getModule(name) {
  if (!modulesLoading) {
    return;
  }
  const modules = await modulesLoading;
  return modules.find((m) => m.packageName === name);
}

export function useReplContext() {
  const { isSyncEnabled, audioEngineTarget } = useSettings();
  const shouldUseWebaudio = audioEngineTarget !== audioEngineTargets.osc;
  const defaultOutput = shouldUseWebaudio ? webaudioOutput : superdirtOutput;
  const getTime = shouldUseWebaudio ? getAudioContextCurrentTime : getPerformanceTimeSeconds;

  const init = useCallback(() => {
    const drawTime = [-2, 2];
    const drawContext = getDrawContext();
    const editor = new StrudelMirror({
      sync: isSyncEnabled,
      defaultOutput,
      getTime,
      setInterval,
      clearInterval,
      transpiler,
      autodraw: false,
      root: containerRef.current,
      initialCode: '',
      pattern: silence,
      drawTime,
      drawContext,
      prebake: async () => Promise.all([modulesLoading, presets]),
      onUpdateState: (state) => {
        setReplState({ ...state });
      },
      onToggle: (playing) => {
        if (!playing) {
          clearHydra();
        }
      },
      beforeEval: () => audioReady,
      afterEval: (all) => {
        const { code } = all;
        window.parent?.postMessage(code);
        setLatestCode(code);
        window.location.hash = '#' + code2hash(code);
        setDocumentTitle(code);

        const viewingPatternData = getViewingPatternData();
        setVersionDefaultsFrom(code);
        const data = { ...viewingPatternData, code };
        let id = data.id;
        const isExamplePattern = viewingPatternData.collection !== userPattern.collection;

        if (isExamplePattern) {
          const codeHasChanged = code !== viewingPatternData.code;
          if (codeHasChanged) {
            const newPattern = userPattern.duplicate(data);
            id = newPattern.id;
            setViewingPatternData(newPattern.data);
          }
        } else {
          id = userPattern.isValidID(id) ? id : createPatternID();
          setViewingPatternData(userPattern.update(id, data).data);
        }
        setActivePattern(id);
      },
      bgFill: false,
    });

    window.strudelMirror = editor;

    initCode().then(async () => {
      const code = `//birder is a Strudel-based environment for live coding with bird sounds.
//getting started with Strudel: https://strudel.cc/workshop/getting-started/ 

setcpm(20);

samples({
  goldfinch: 'https://chestersoundproject.com/sounds/american_goldfinch.mp3'
});

//a list of samples can be found at: https://chestersoundproject.com/archive

//           -##                          ...                   
//          ######+                  +##########+               
//             +######.        .##################.             
//                 ################################.            
//                   #############################+++-          
//                    ##########################-               
//                  +###########################                
//                    .########################-                
//                      #######################                 
//                      .#####################                  
//                        ##################                    
//                          #############+                      
//                           ##    -#                           
//                            +      #                          
//                            #       -#   

const pad = "<ab3 c4 eb4> <db3 f3 ab3> <eb3 g3 bb3> <db3 f3 ab3>";
const ocarina = "<f4 g4 ab4 ~ g4 f4 ~ ~>";
const choir = "<c5 eb5 ab5 c6 eb6 ab6 c6 eb5>";

let chirp = s("goldfinch")
  .mask("<1 0 0 0>")
  .gain(0.8)
  .attack(0.5)
  .release(4)
  .room(1.1)
  .roomsize(12)
  .pan(sine.range(-0.6, 0.6).slow(9));

stack(
  note(pad)
    .sound("gm_pad_warm:2")._pianoroll()
    .gain(0.3)
    .attack(1.5)
    .release(3)
    .room(1.2)
    .roomsize(12)
    .lpf(sine.range(400, 1300).slow(15))
    .phaser(0.2)
    .delay(2, 0.4, 0.3)
    .pan(sine.range(-0.3, 0.3).slow(10)),

  note(ocarina)
    .sound("gm_ocarina:2")._pianoroll()
    .gain(0.2)
    .attack(0.6)
    .release(2)
    .room(1)
    .roomsize(12)
    .delay(3, 0.35, 0.25)
    .pan(sine.range(-0.5, 0.5).slow(12)),

  note(choir)
    .sound("gm_synth_choir:1")._pianoroll()
    .gain(0.2)
    .attack(1.5)
    .release(3)
    .room(1.2)
    .roomsize(12)
    .lpf(sine.range(400, 1300).slow(15))
    .phaser(0.2)
    .delay(2, 0.4, 0.3)
    .pan(sine.range(-0.3, 0.3).slow(10)),

  chirp
).cpm(20);

`;
      editor.setCode(code);
      setDocumentTitle(code);
      logger(`Welcome to Strudel! Your custom code has been loaded!`, 'highlight');
    });

    editorRef.current = editor;
  }, []);

  const [replState, setReplState] = useState({});
  const { started, isDirty, error, activeCode, pending } = replState;
  const editorRef = useRef();
  const containerRef = useRef();

  const _settings = useStore(settingsMap, { keys: Object.keys(defaultSettings) });
  useEffect(() => {
    let editorSettings = {};
    Object.keys(defaultSettings).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(_settings, key)) {
        editorSettings[key] = _settings[key];
      }
    });
    editorRef.current?.updateSettings(editorSettings);
  }, [_settings]);

  const setDocumentTitle = (code) => {
    const meta = getMetadata(code);
    document.title = (meta.title ? `${meta.title} - ` : '') + 'Strudel REPL';
  };

  const handleTogglePlay = async () => {
    editorRef.current?.toggle();
  };

  const resetEditor = async () => {
    (await getModule('@strudel/tonal'))?.resetVoicings();
    resetGlobalEffects();
    clearCanvas();
    clearHydra();
    resetLoadedSounds();
    editorRef.current.repl.setCps(0.5);
    await prebake();
  };

  const handleUpdate = async (patternData, reset = false) => {
    setViewingPatternData(patternData);
    editorRef.current.setCode(patternData.code);
    if (reset) {
      await resetEditor();
      handleEvaluate();
    }
  };

  const handleEvaluate = () => {
    editorRef.current.evaluate();
  };

  const handleShuffle = async () => {
    const patternData = await getRandomTune();
    const code = patternData.code;
    logger(`[repl] ✨ loading random tune "${patternData.id}"`);
    setActivePattern(patternData.id);
    setViewingPatternData(patternData);
    await resetEditor();
    editorRef.current.setCode(code);
    editorRef.current.repl.evaluate(code);
  };

  const handleShare = async () => shareCode(replState.code);

  const context = {
    started,
    pending,
    isDirty,
    activeCode,
    handleTogglePlay,
    handleUpdate,
    handleShuffle,
    handleShare,
    handleEvaluate,
    init,
    error,
    editorRef,
    containerRef,
  };

  return context;
}
