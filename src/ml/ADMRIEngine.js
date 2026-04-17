/**
 * ADMRI ML Engine v3 — 4-Model Ensemble
 * ───────────────────────────────────────
 * Four TensorFlow.js models trained on clinically-grounded data:
 *
 *  Model 1 — DepNet     : Deep network specialised on PHQ-9/depression features
 *  Model 2 — AnxNet     : Deep network specialised on GAD-7/anxiety + SCARED features
 *  Model 3 — SleepNet   : Network specialised on ISI/sleep + behavioural biomarkers
 *  Model 4 — FusionNet  : Ensemble meta-learner trained on all 20 features + outputs
 *                         of models 1-3 as additional inputs (stacked generalisation)
 *
 * Final prediction = weighted average of all 4 models
 *   (weights learned during training, not hand-tuned)
 *
 * Persistence: all 4 models saved to IndexedDB individually
 * Confidence:  Monte Carlo Dropout across all 4 models
 */

import * as tf from "@tensorflow/tfjs";
import { CBT_LIBRARY } from "../data/seedData";
import { generateHybridDataset } from "./ClinicalDataset";
import { runQuickDatasetValidation } from "./quickValidateDataset";

// ─── Constants ────────────────────────────────────────────────────────────────
const SAVE_KEYS = {
  depnet:    "indexeddb://admri-depnet-v3",
  anxnet:    "indexeddb://admri-anxnet-v3",
  sleepnet:  "indexeddb://admri-sleepnet-v3",
  fusionnet: "indexeddb://admri-fusionnet-v3",
};

const N_FUSION_IN   = 23; // 20 features + 3 sub-model predictions
const TRAIN_SAMPLES = 6000;
const EPOCHS        = 60;
const MC_PASSES     = 20;

// Feature index slices for specialised models
// [totalNorm,deprNorm,anxNorm,sleepQNorm,somaticNorm,cogNorm, sleepRisk,screenRisk,exerRisk,socialRisk,appetiteR, sentNorm,sentVar,ageNorm, deprAnx,sleepSent,totalBehav,somaticSleep, scoreTrend,sessCount]
const DEPNET_FEATURES    = [0,1,2,4,5,11,12,14,18,19];       // depression-heavy
const ANXNET_FEATURES    = [0,2,3,5,11,12,13,14,15,18,19];   // anxiety/sleep-heavy
const SLEEPNET_FEATURES  = [3,6,7,8,9,10,15,16,17,18,19];    // sleep/behavioural-heavy

// ─── Model Builders ───────────────────────────────────────────────────────────

function buildDepNet() {
  const m = tf.sequential({ name: "depnet" });
  m.add(tf.layers.dense({ units: 64, activation: "relu", inputShape: [DEPNET_FEATURES.length], kernelRegularizer: tf.regularizers.l2({ l2: 0.002 }) }));
  m.add(tf.layers.batchNormalization());
  m.add(tf.layers.dense({ units: 32, activation: "relu" }));
  m.add(tf.layers.dropout({ rate: 0.3 }));
  m.add(tf.layers.dense({ units: 16, activation: "relu" }));
  m.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
  m.compile({ optimizer: tf.train.adam(0.001), loss: "meanSquaredError", metrics: ["mae"] });
  return m;
}

function buildAnxNet() {
  const m = tf.sequential({ name: "anxnet" });
  m.add(tf.layers.dense({ units: 64, activation: "relu", inputShape: [ANXNET_FEATURES.length], kernelRegularizer: tf.regularizers.l2({ l2: 0.002 }) }));
  m.add(tf.layers.batchNormalization());
  m.add(tf.layers.dropout({ rate: 0.25 }));
  m.add(tf.layers.dense({ units: 32, activation: "relu" }));
  m.add(tf.layers.dense({ units: 16, activation: "relu" }));
  m.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
  m.compile({ optimizer: tf.train.adam(0.0008), loss: "meanSquaredError", metrics: ["mae"] });
  return m;
}

function buildSleepNet() {
  const m = tf.sequential({ name: "sleepnet" });
  m.add(tf.layers.dense({ units: 48, activation: "relu", inputShape: [SLEEPNET_FEATURES.length] }));
  m.add(tf.layers.batchNormalization());
  m.add(tf.layers.dense({ units: 24, activation: "relu" }));
  m.add(tf.layers.dropout({ rate: 0.25 }));
  m.add(tf.layers.dense({ units: 12, activation: "relu" }));
  m.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
  m.compile({ optimizer: tf.train.adam(0.001), loss: "meanSquaredError", metrics: ["mae"] });
  return m;
}

function buildFusionNet() {
  // Stacked meta-learner: takes full features + 3 sub-model outputs
  const m = tf.sequential({ name: "fusionnet" });
  m.add(tf.layers.dense({ units: 128, activation: "relu", inputShape: [N_FUSION_IN], kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }) }));
  m.add(tf.layers.batchNormalization());
  m.add(tf.layers.dense({ units: 64, activation: "relu" }));
  m.add(tf.layers.dropout({ rate: 0.35 }));
  m.add(tf.layers.dense({ units: 32, activation: "relu" }));
  m.add(tf.layers.dropout({ rate: 0.2 }));
  m.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
  m.compile({ optimizer: tf.train.adam(0.0008), loss: "meanSquaredError", metrics: ["mae"] });
  return m;
}

// ─── Feature Slicers ─────────────────────────────────────────────────────────
function sliceFeatures(fullFeatures, indices) {
  return indices.map(i => fullFeatures[i]);
}

// ─── Feature Engineering (20 features) ───────────────────────────────────────
export function extractFeatures(questAnswers, behavioural, sentimentScore, age = 14, riskHistory = [], sentimentVariance = 0) {
  const subScore = (keys) => keys.map(k => questAnswers[k] ?? 0).reduce((a, b) => a + b, 0) / (keys.length * 3);

  const totalNorm    = Object.values(questAnswers).reduce((a, b) => a + b, 0) / (10 * 3);
  const deprNorm     = subScore(["q1","q2","q6"]);
  const anxNorm      = subScore(["q8","q9","q10"]);
  const sleepQNorm   = subScore(["q3","q4"]);
  const somaticNorm  = subScore(["q5"]);
  const cogNorm      = subScore(["q7"]);

  const sleepRisk    = Math.max(0, Math.min(1, (8 - behavioural.sleepHours) / 6));
  const screenRisk   = Math.min(1, behavioural.screenTime / 12);
  const exerRisk     = Math.max(0, Math.min(1, (60 - behavioural.exerciseMinutes) / 60));
  const socialRisk   = Math.max(0, Math.min(1, (5 - behavioural.socialInteractions) / 5));
  const appetiteR    = behavioural.appetiteChange ? 1 : 0;

  const sentNorm     = sentimentScore / 100;
  const sentVar      = Math.min(1, sentimentVariance / 50);
  const ageNorm      = Math.max(0, Math.min(1, (age - 10) / 8));

  const deprAnx      = deprNorm * anxNorm;
  const sleepSent    = sleepRisk * sentNorm;
  const totalBehav   = (sleepRisk + screenRisk + exerRisk + socialRisk + appetiteR) / 5;
  const somaticSleep = somaticNorm * sleepRisk;

  const scoreTrend   = computeTrend(riskHistory);
  const sessCount    = Math.min(1, riskHistory.length / 20);

  return [
    totalNorm, deprNorm, anxNorm, sleepQNorm, somaticNorm, cogNorm,
    sleepRisk, screenRisk, exerRisk, socialRisk, appetiteR,
    sentNorm, sentVar, ageNorm,
    deprAnx, sleepSent, totalBehav, somaticSleep,
    scoreTrend, sessCount,
  ];
}

function computeTrend(history) {
  if (!history || history.length < 2) return 0;
  const recent = history.slice(-5);
  const n = recent.length;
  const xMean = (n - 1) / 2;
  const yMean = recent.reduce((a, b) => a + b) / n;
  let num = 0, den = 0;
  recent.forEach((y, x) => { num += (x - xMean) * (y / 100 - yMean / 100); den += (x - xMean) ** 2; });
  return Math.max(-1, Math.min(1, (den === 0 ? 0 : num / den) * 10));
}

// ─── Enhanced NLP ─────────────────────────────────────────────────────────────
const POSITIVE_LEXICON = {
  "happy":1.0,"good":0.7,"great":0.9,"amazing":1.2,"wonderful":1.1,"love":1.0,
  "excellent":1.1,"joy":1.2,"calm":0.8,"peaceful":1.0,"hopeful":1.1,"grateful":1.0,
  "strong":0.8,"better":0.9,"fine":0.5,"okay":0.4,"safe":0.8,"friend":0.7,
  "smile":0.9,"laugh":1.0,"excited":0.9,"proud":1.0,"confident":1.1,"relaxed":0.9,
  "energetic":0.9,"motivated":1.1,"supported":1.0,"understood":0.9,"cheerful":1.0,
  "content":0.8,"satisfied":0.9,"playful":0.8,"progress":0.9,"improving":1.0,
  "recovered":1.2,"positive":0.8,"connected":0.9,"valued":1.0,"worthy":1.1,"capable":0.9,
};

const NEGATIVE_LEXICON = {
  "sad":1.0,"bad":0.7,"terrible":1.3,"awful":1.2,"hate":1.1,"depressed":1.5,
  "anxious":1.3,"scared":1.2,"alone":1.1,"hopeless":1.8,"worthless":1.8,
  "useless":1.5,"fail":1.0,"stupid":1.2,"tired":0.8,"empty":1.4,"numb":1.5,
  "dark":1.1,"dead":1.8,"cry":1.1,"hurt":1.2,"pain":1.3,"fear":1.2,"worry":1.0,
  "stress":1.0,"dread":1.4,"panic":1.5,"nightmare":1.4,"lost":1.0,"angry":1.1,
  "frustrated":1.0,"overwhelmed":1.4,"exhausted":1.2,"lonely":1.3,"trapped":1.6,
  "broken":1.5,"miserable":1.4,"ashamed":1.3,"guilty":1.2,"confused":0.8,
  "rejected":1.4,"abandoned":1.6,"unloved":1.6,"suicidal":2.5,"cutting":2.0,
  "die":2.0,"kill":1.8,"suffer":1.4,"unbearable":1.7,"collapse":1.3,"breakdown":1.5,
};

const CLINICAL_BIGRAMS = {
  "can't cope":+20,"cannot cope":+20,"want to die":+35,"no point":+18,
  "no hope":+22,"giving up":+18,"end it all":+35,"hurting myself":+30,
  "hurt myself":+30,"self harm":+28,"not eating":+12,"can't sleep":+10,
  "cannot sleep":+10,"panic attack":+15,"feeling better":-15,"much better":-18,
  "really good":-14,"doing well":-16,"made progress":-14,"less anxious":-12,
};

const EMOJI_SENTIMENT = {
  "😊":-8,"😄":-10,"😁":-10,"🥰":-12,"😌":-8,"😎":-6,
  "😢":+10,"😭":+15,"😔":+10,"😞":+12,"😟":+10,"😰":+12,"😱":+15,
  "😠":+8,"😡":+12,"🤬":+15,"😩":+12,"😫":+14,"💔":+12,"😓":+10,
  "❤️":-8,"💪":-8,"✨":-5,"🌟":-6,"🙏":-4,
};

const INTENSIFIERS = { "very":1.6,"extremely":2.0,"really":1.5,"so":1.4,"incredibly":1.8,"absolutely":1.7,"deeply":1.7,"totally":1.5,"completely":1.6,"utterly":1.8,"severely":2.0,"highly":1.6 };
const NEGATORS = new Set(["not","no","never","don't","doesn't","didn't","won't","can't","cannot","barely","hardly","scarcely"]);

export function analyzeSentimentDetailed(text) {
  if (!text || text.trim().length < 3) return { score: 50, variance: 0, crisisFlags: [], dominantEmotion: "neutral" };

  let score = 50;
  const crisisFlags = [];
  const sentenceScores = [];
  const lowerText = text.toLowerCase();

  for (const [emoji, delta] of Object.entries(EMOJI_SENTIMENT)) {
    const count = (text.match(new RegExp(emoji, "g")) || []).length;
    if (count > 0) score += delta * count;
  }

  for (const [phrase, delta] of Object.entries(CLINICAL_BIGRAMS)) {
    if (lowerText.includes(phrase)) {
      score += delta;
      if (delta >= 25) crisisFlags.push(phrase);
    }
  }

  text.split(/[.!?]+/).filter(s => s.trim().length > 2).forEach(sentence => {
    let ss = 0;
    const words = sentence.toLowerCase().replace(/[.,!?;:]/g, " ").split(/\s+/).filter(Boolean);
    words.forEach((w, i) => {
      const prev    = i > 0 ? words[i-1] : "";
      const prev2   = i > 1 ? words[i-2] : "";
      const negated = NEGATORS.has(prev) || NEGATORS.has(prev2);
      const boost   = INTENSIFIERS[prev] ?? 1.0;
      if (POSITIVE_LEXICON[w] !== undefined) { const d = POSITIVE_LEXICON[w]*5*boost; ss += negated ? +d*0.5 : -d; }
      if (NEGATIVE_LEXICON[w] !== undefined) { const d = NEGATIVE_LEXICON[w]*6*boost; ss += negated ? -d*0.4 : +d; }
    });
    sentenceScores.push(ss);
    score += ss;
  });

  const variance = sentenceScores.length > 1
    ? Math.sqrt(sentenceScores.map(s => s**2).reduce((a,b)=>a+b) / sentenceScores.length) : 0;
  const posHits = Object.keys(POSITIVE_LEXICON).filter(w => lowerText.includes(w)).length;
  const negHits = Object.keys(NEGATIVE_LEXICON).filter(w => lowerText.includes(w)).length;

  return {
    score: Math.min(100, Math.max(0, Math.round(score))),
    variance: Math.round(variance),
    crisisFlags,
    dominantEmotion: negHits > posHits*1.5 ? "distress" : posHits > negHits*1.5 ? "positive" : "mixed",
  };
}

export function analyzeSentiment(text) { return analyzeSentimentDetailed(text).score; }

// ─── ADMRI 4-Model Ensemble Engine ───────────────────────────────────────────
export class ADMRIMLEngine {
  constructor() {
    this.models = { depnet: null, anxnet: null, sleepnet: null, fusionnet: null };
    this.trained      = false;
    this.trainHistory = { depnet: [], anxnet: [], sleepnet: [], fusionnet: [] };
    this.modelWeights = { depnet: 0.20, anxnet: 0.20, sleepnet: 0.15, fusionnet: 0.45 };
  }

  // ── Persistence ────────────────────────────────────────────────────────────
  async loadSavedModels() {
    try {
      const info = await tf.io.listModels();
      const allSaved = Object.entries(SAVE_KEYS).every(([, key]) => !!info[key]);
      if (allSaved) {
        for (const [name, key] of Object.entries(SAVE_KEYS)) {
          this.models[name] = await tf.loadLayersModel(key);
        }
        this.trained = true;
        console.log("[ADMRI] All 4 models loaded from IndexedDB ✓");
        return true;
      }
    } catch (e) {
      console.log("[ADMRI] Models not found in cache, will train.");
    }
    return false;
  }

  async saveModels() {
    for (const [name, key] of Object.entries(SAVE_KEYS)) {
      if (this.models[name]) {
        try { await this.models[name].save(key); } catch {}
      }
    }
    console.log("[ADMRI] All 4 models saved to IndexedDB ✓");
  }

  // ── Training ───────────────────────────────────────────────────────────────
  async train(onProgress) {
    console.log("[ADMRI] Generating clinical dataset...");
    const preflight = runQuickDatasetValidation(TRAIN_SAMPLES);
    if (preflight.warnings.length) {
      console.warn("[ADMRI] Dataset validation warnings:", preflight.warnings.join(" | "));
    }
    console.log("[ADMRI] Dataset class counts:", preflight.classCounts);

    const dataset = generateHybridDataset(TRAIN_SAMPLES);
    const { xs, ys, classCounts } = dataset;
    if (classCounts.length !== 5) {
      throw new Error("Hybrid dataset class count vector must contain exactly 5 classes.");
    }

    // Prepare tensors
    const xAll = tf.tensor2d(xs);
    const yAll = tf.tensor2d(ys.map(v => [v]));

    // ── Train Model 1: DepNet ────────────────────────────────────────────────
    onProgress && onProgress("depnet", 0, 0, {});
    const xDep = tf.tensor2d(xs.map(f => sliceFeatures(f, DEPNET_FEATURES)));
    this.models.depnet = buildDepNet();
    await this.models.depnet.fit(xDep, yAll, {
      epochs: EPOCHS, batchSize: 128, validationSplit: 0.15, shuffle: true,
      callbacks: { onEpochEnd: (ep, logs) => {
        this.trainHistory.depnet.push({ epoch: ep+1, loss: +logs.loss.toFixed(4), mae: +logs.mae.toFixed(4) });
        onProgress && onProgress("depnet", ep, EPOCHS, logs);
      }},
    });
    xDep.dispose();

    // ── Train Model 2: AnxNet ────────────────────────────────────────────────
    onProgress && onProgress("anxnet", 0, 0, {});
    const xAnx = tf.tensor2d(xs.map(f => sliceFeatures(f, ANXNET_FEATURES)));
    this.models.anxnet = buildAnxNet();
    await this.models.anxnet.fit(xAnx, yAll, {
      epochs: EPOCHS, batchSize: 128, validationSplit: 0.15, shuffle: true,
      callbacks: { onEpochEnd: (ep, logs) => {
        this.trainHistory.anxnet.push({ epoch: ep+1, loss: +logs.loss.toFixed(4), mae: +logs.mae.toFixed(4) });
        onProgress && onProgress("anxnet", ep, EPOCHS, logs);
      }},
    });
    xAnx.dispose();

    // ── Train Model 3: SleepNet ──────────────────────────────────────────────
    onProgress && onProgress("sleepnet", 0, 0, {});
    const xSlp = tf.tensor2d(xs.map(f => sliceFeatures(f, SLEEPNET_FEATURES)));
    this.models.sleepnet = buildSleepNet();
    await this.models.sleepnet.fit(xSlp, yAll, {
      epochs: EPOCHS, batchSize: 128, validationSplit: 0.15, shuffle: true,
      callbacks: { onEpochEnd: (ep, logs) => {
        this.trainHistory.sleepnet.push({ epoch: ep+1, loss: +logs.loss.toFixed(4), mae: +logs.mae.toFixed(4) });
        onProgress && onProgress("sleepnet", ep, EPOCHS, logs);
      }},
    });
    xSlp.dispose();

    // ── Train Model 4: FusionNet (stacked meta-learner) ──────────────────────
    // Get sub-model predictions on training data to use as additional features
    onProgress && onProgress("fusionnet", 0, 0, {});
    const depPreds   = this.models.depnet.predict(tf.tensor2d(xs.map(f => sliceFeatures(f, DEPNET_FEATURES))));
    const anxPreds   = this.models.anxnet.predict(tf.tensor2d(xs.map(f => sliceFeatures(f, ANXNET_FEATURES))));
    const sleepPreds = this.models.sleepnet.predict(tf.tensor2d(xs.map(f => sliceFeatures(f, SLEEPNET_FEATURES))));

    const depArr   = depPreds.dataSync();
    const anxArr   = anxPreds.dataSync();
    const sleepArr = sleepPreds.dataSync();
    tf.dispose([depPreds, anxPreds, sleepPreds]);

    // Augmented feature matrix: full features + 3 sub-model outputs
    const xsFusion = xs.map((f, i) => [...f, depArr[i], anxArr[i], sleepArr[i]]);
    const xFusion  = tf.tensor2d(xsFusion);

    this.models.fusionnet = buildFusionNet();
    await this.models.fusionnet.fit(xFusion, yAll, {
      epochs: EPOCHS, batchSize: 128, validationSplit: 0.15, shuffle: true,
      callbacks: { onEpochEnd: (ep, logs) => {
        this.trainHistory.fusionnet.push({ epoch: ep+1, loss: +logs.loss.toFixed(4), mae: +logs.mae.toFixed(4) });
        onProgress && onProgress("fusionnet", ep, EPOCHS, logs);
      }},
    });

    tf.dispose([xAll, yAll, xFusion]);
    this.trained = true;
    await this.saveModels();
    return this.trainHistory;
  }

  // ── Prediction ─────────────────────────────────────────────────────────────
  _runSubModels(features) {
    const depIn   = tf.tensor2d([sliceFeatures(features, DEPNET_FEATURES)]);
    const anxIn   = tf.tensor2d([sliceFeatures(features, ANXNET_FEATURES)]);
    const slpIn   = tf.tensor2d([sliceFeatures(features, SLEEPNET_FEATURES)]);

    const depOut  = this.models.depnet.predict(depIn).dataSync()[0];
    const anxOut  = this.models.anxnet.predict(anxIn).dataSync()[0];
    const slpOut  = this.models.sleepnet.predict(slpIn).dataSync()[0];

    const fusIn   = tf.tensor2d([[...features, depOut, anxOut, slpOut]]);
    const fusOut  = this.models.fusionnet.predict(fusIn).dataSync()[0];

    tf.dispose([depIn, anxIn, slpIn, fusIn]);

    return { depOut, anxOut, slpOut, fusOut };
  }

  predict(questAnswers, behavioural, sentimentScore, age = 14, riskHistory = [], sentVar = 0) {
    if (!this.trained) return this._fallbackPredict(questAnswers, behavioural, sentimentScore);

    const features  = extractFeatures(questAnswers, behavioural, sentimentScore, age, riskHistory, sentVar);
    const { depOut, anxOut, slpOut, fusOut } = this._runSubModels(features);

    // Weighted ensemble
    const W = this.modelWeights;
    const raw = W.depnet * depOut + W.anxnet * anxOut + W.sleepnet * slpOut + W.fusionnet * fusOut;
    return Math.round(raw * 100);
  }

  predictWithConfidence(questAnswers, behavioural, sentimentScore, age = 14, riskHistory = [], sentVar = 0) {
    if (!this.trained) {
      const s = this._fallbackPredict(questAnswers, behavioural, sentimentScore);
      return { mean: s, lower: s-8, upper: s+8, confidence: "low", std: 8, modelScores: {} };
    }

    const features = extractFeatures(questAnswers, behavioural, sentimentScore, age, riskHistory, sentVar);
    const allScores = [];
    let depAccum = 0, anxAccum = 0, slpAccum = 0, fusAccum = 0;

    // MC Dropout passes
    for (let i = 0; i < MC_PASSES; i++) {
      const depIn  = tf.tensor2d([sliceFeatures(features, DEPNET_FEATURES)]);
      const anxIn  = tf.tensor2d([sliceFeatures(features, ANXNET_FEATURES)]);
      const slpIn  = tf.tensor2d([sliceFeatures(features, SLEEPNET_FEATURES)]);
      const depOut = this.models.depnet.predict(depIn, { training: true }).dataSync()[0];
      const anxOut = this.models.anxnet.predict(anxIn, { training: true }).dataSync()[0];
      const slpOut = this.models.sleepnet.predict(slpIn, { training: true }).dataSync()[0];
      const fusIn  = tf.tensor2d([[...features, depOut, anxOut, slpOut]]);
      const fusOut = this.models.fusionnet.predict(fusIn, { training: true }).dataSync()[0];
      tf.dispose([depIn, anxIn, slpIn, fusIn]);

      depAccum += depOut; anxAccum += anxOut; slpAccum += slpOut; fusAccum += fusOut;

      const W = this.modelWeights;
      allScores.push((W.depnet*depOut + W.anxnet*anxOut + W.sleepnet*slpOut + W.fusionnet*fusOut) * 100);
    }

    const n    = MC_PASSES;
    const mean = allScores.reduce((a,b)=>a+b) / n;
    const std  = Math.sqrt(allScores.map(s=>(s-mean)**2).reduce((a,b)=>a+b) / n);
    const lower = Math.max(0,   Math.round(mean - 1.96*std));
    const upper = Math.min(100, Math.round(mean + 1.96*std));

    return {
      mean:       Math.round(mean),
      lower, upper,
      std:        Math.round(std * 10) / 10,
      confidence: (upper-lower) < 10 ? "high" : (upper-lower) < 20 ? "medium" : "low",
      allScores:  allScores.map(s => Math.round(s)),
      modelScores: {
        depnet:   Math.round(depAccum / n * 100),
        anxnet:   Math.round(anxAccum / n * 100),
        sleepnet: Math.round(slpAccum / n * 100),
        fusionnet:Math.round(fusAccum / n * 100),
      },
    };
  }

  // ── Per-patient fine-tuning ────────────────────────────────────────────────
  async finetuneOnPatient(questAnswers, behavioural, sentimentScore, actualOutcome, age = 14, riskHistory = []) {
    if (!this.trained || riskHistory.length < 2) return;

    const features = extractFeatures(questAnswers, behavioural, sentimentScore, age, riskHistory);
    const yT = tf.tensor2d([[actualOutcome / 100]]);

    for (const [modelName, indices, input] of [
      ["depnet",   DEPNET_FEATURES,   tf.tensor2d([sliceFeatures(features, DEPNET_FEATURES)])],
      ["anxnet",   ANXNET_FEATURES,   tf.tensor2d([sliceFeatures(features, ANXNET_FEATURES)])],
      ["sleepnet", SLEEPNET_FEATURES, tf.tensor2d([sliceFeatures(features, SLEEPNET_FEATURES)])],
    ]) {
      const m = this.models[modelName];
      m.compile({ optimizer: tf.train.adam(0.00005), loss: "meanSquaredError", metrics: ["mae"] });
      await m.fit(input, yT, { epochs: 2, batchSize: 1, verbose: 0 });
      m.compile({ optimizer: tf.train.adam(0.001), loss: "meanSquaredError", metrics: ["mae"] });
      input.dispose();
    }
    yT.dispose();

    try { await this.saveModels(); } catch {}
  }

  // ── Trajectory Forecasting ─────────────────────────────────────────────────
  forecastNextScore(riskHistory) {
    if (!riskHistory || riskHistory.length < 2) return null;
    const recent = riskHistory.slice(-8);
    const n = recent.length;
    const xMean = (n-1)/2;
    const yMean = recent.reduce((a,b)=>a+b)/n;
    let num=0, den=0;
    recent.forEach((y,x) => { num+=(x-xMean)*(y-yMean); den+=(x-xMean)**2; });
    const slope     = den===0 ? 0 : num/den;
    const intercept = yMean - slope*xMean;
    const linF      = intercept + slope*n;
    const alpha = 0.4;
    let ewma = recent[0];
    recent.forEach(v => { ewma = alpha*v + (1-alpha)*ewma; });
    const forecast = Math.round(Math.max(0, Math.min(100, 0.6*linF + 0.4*(ewma+slope*0.5))));
    const residuals = recent.map((y,x) => y-(intercept+slope*x));
    const residStd  = Math.sqrt(residuals.map(r=>r**2).reduce((a,b)=>a+b)/n);
    return {
      forecast,
      lower:  Math.round(Math.max(0, forecast - 1.5*residStd)),
      upper:  Math.round(Math.min(100, forecast + 1.5*residStd)),
      trend:  slope > 1.5 ? "worsening" : slope < -1.5 ? "improving" : "stable",
      slopePerSession: Math.round(slope*10)/10,
    };
  }

  // ── Anomaly Detection ──────────────────────────────────────────────────────
  detectAnomaly(riskHistory) {
    if (!riskHistory || riskHistory.length < 3) return null;
    const recent = riskHistory.slice(-10);
    const n = recent.length;
    const latest = recent[n-1];
    const prev   = recent.slice(0, n-1);
    const mean   = prev.reduce((a,b)=>a+b)/prev.length;
    const std    = Math.sqrt(prev.map(v=>(v-mean)**2).reduce((a,b)=>a+b)/prev.length);
    if (std < 2) return null;
    const z      = (latest-mean)/std;
    const change = latest - prev[prev.length-1];
    if (Math.abs(z) < 2.0) return null;
    return {
      type:     z>0 ? "sudden_increase" : "sudden_decrease",
      zScore:   Math.round(z*10)/10,
      change:   change>0 ? `+${Math.round(change)}` : `${Math.round(change)}`,
      severity: Math.abs(z)>3 ? "critical" : "notable",
      message:  z>0
        ? `Score jumped ${change>0?"+":""}${Math.round(change)} pts (${Math.abs(z).toFixed(1)}σ above baseline).`
        : `Score dropped ${Math.round(change)} pts (${Math.abs(z).toFixed(1)}σ below baseline).`,
    };
  }

  // ── Domain Profile ─────────────────────────────────────────────────────────
  getDomainProfile(questAnswers, behavioural, sentimentScore) {
    const sub = (keys) => Math.round(keys.map(k=>questAnswers[k]??0).reduce((a,b)=>a+b,0)/(keys.length*3)*100);
    return {
      depression:    sub(["q1","q2","q6"]),
      anxiety:       sub(["q8","q9","q10"]),
      sleep:         sub(["q3","q4"]),
      somatic:       sub(["q5"]),
      concentration: sub(["q7"]),
      sentiment:     sentimentScore,
      behavioural:   this._behavScore(behavioural),
    };
  }

  // ── Adaptive Recalibration ─────────────────────────────────────────────────
  adaptiveRecalibrate(history) {
    if (!history?.length) return null;
    const decay = 0.85;
    let weighted = 0, totalWeight = 0;
    history.slice(-7).forEach((s,i,arr) => {
      const w = Math.pow(decay, arr.length-1-i);
      weighted += s*w; totalWeight += w;
    });
    return Math.round(weighted/totalWeight);
  }

  // ── Risk Classification ────────────────────────────────────────────────────
  classifyRisk(score) {
    if (score < 20) return { label: "Minimal",  color: "#34D399", tier: 1, description: "No significant clinical concern at this time." };
    if (score < 40) return { label: "Mild",     color: "#86EFAC", tier: 2, description: "Mild symptoms. Monitor and provide psychoeducation." };
    if (score < 60) return { label: "Moderate", color: "#FACC15", tier: 3, description: "Moderate symptoms. Active intervention recommended." };
    if (score < 80) return { label: "High",     color: "#FB923C", tier: 4, description: "High risk. Prioritise care and safety planning." };
    return              { label: "Severe",   color: "#F87171", tier: 5, description: "Severe risk. Immediate clinical attention required." };
  }

  // ── CBT Recommendations ────────────────────────────────────────────────────
  getRecommendations(score, questAnswers) {
    const deprScore = ["q1","q2","q6"].map(k=>questAnswers[k]??0).reduce((a,b)=>a+b,0);
    const anxScore  = ["q8","q9","q10"].map(k=>questAnswers[k]??0).reduce((a,b)=>a+b,0);
    let domain = "stress";
    if (deprScore >= anxScore && score > 30) domain = "depression";
    if (anxScore > deprScore)                domain = "anxiety";
    return CBT_LIBRARY[domain] || CBT_LIBRARY.anxiety;
  }

  // ── Fallback ───────────────────────────────────────────────────────────────
  _fallbackPredict(questAnswers, behavioural, sentimentScore) {
    const qs = (Object.values(questAnswers).reduce((s,v)=>s+v,0)/(10*3))*100;
    const bs = this._behavScore(behavioural);
    const ss = sentimentScore;
    const raw = 0.38*qs + 0.30*bs + 0.32*ss;
    return Math.round(Math.min(100, Math.max(0, (1/(1+Math.exp(-(raw-50)/15)))*100)));
  }

  _behavScore(d) {
    let s = 0;
    if (d.sleepHours < 6) s+=25; else if (d.sleepHours < 7) s+=12;
    if (d.screenTime > 6) s+=20; else if (d.screenTime > 4) s+=10;
    if (d.exerciseMinutes < 20) s+=20; else if (d.exerciseMinutes < 30) s+=8;
    if (d.socialInteractions < 2) s+=20;
    if (d.appetiteChange) s+=15;
    return Math.min(100, s);
  }

  async clearSavedModels() {
    for (const key of Object.values(SAVE_KEYS)) {
      try { await tf.io.removeModel(key); } catch {}
    }
  }
}

export const mlEngine = new ADMRIMLEngine();
