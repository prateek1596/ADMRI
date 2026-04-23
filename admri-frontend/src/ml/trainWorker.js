/* eslint-disable no-restricted-globals */
/**
 * ADMRI Training Web Worker
 * ──────────────────────────
 * Uses the same hybrid dataset generator and validation checks as
 * the main-thread engine to keep training behavior fully consistent.
 */

import * as tf from "@tensorflow/tfjs";
import { generateHybridDataset } from "./ClinicalDataset";
import { runQuickDatasetValidation } from "./quickValidateDataset";

const MODEL_SAVE_KEYS = {
  depnet:    "indexeddb://admri-depnet-v3",
  anxnet:    "indexeddb://admri-anxnet-v3",
  sleepnet:  "indexeddb://admri-sleepnet-v3",
  fusionnet: "indexeddb://admri-fusionnet-v3",
};

const N_FUSION_IN    = 23;
const TRAIN_SAMPLES  = 6000;
const EPOCHS         = 60;

const DEPNET_FEATURES    = [0,1,2,4,5,11,12,14,18,19];
const ANXNET_FEATURES    = [0,2,3,5,11,12,13,14,15,18,19];
const SLEEPNET_FEATURES  = [3,6,7,8,9,10,15,16,17,18,19];

function sliceFeatures(f, indices) { return indices.map(i => f[i]); }

// ── Model builders ────────────────────────────────────────────────────────────
function buildDepNet() {
  const m=tf.sequential();
  m.add(tf.layers.dense({units:64,activation:"relu",inputShape:[DEPNET_FEATURES.length],kernelRegularizer:tf.regularizers.l2({l2:0.002})}));
  m.add(tf.layers.batchNormalization());
  m.add(tf.layers.dense({units:32,activation:"relu"}));
  m.add(tf.layers.dropout({rate:0.3}));
  m.add(tf.layers.dense({units:16,activation:"relu"}));
  m.add(tf.layers.dense({units:1,activation:"sigmoid"}));
  m.compile({optimizer:tf.train.adam(0.001),loss:"meanSquaredError",metrics:["mae"]});
  return m;
}
function buildAnxNet() {
  const m=tf.sequential();
  m.add(tf.layers.dense({units:64,activation:"relu",inputShape:[ANXNET_FEATURES.length],kernelRegularizer:tf.regularizers.l2({l2:0.002})}));
  m.add(tf.layers.batchNormalization());
  m.add(tf.layers.dropout({rate:0.25}));
  m.add(tf.layers.dense({units:32,activation:"relu"}));
  m.add(tf.layers.dense({units:16,activation:"relu"}));
  m.add(tf.layers.dense({units:1,activation:"sigmoid"}));
  m.compile({optimizer:tf.train.adam(0.0008),loss:"meanSquaredError",metrics:["mae"]});
  return m;
}
function buildSleepNet() {
  const m=tf.sequential();
  m.add(tf.layers.dense({units:48,activation:"relu",inputShape:[SLEEPNET_FEATURES.length]}));
  m.add(tf.layers.batchNormalization());
  m.add(tf.layers.dense({units:24,activation:"relu"}));
  m.add(tf.layers.dropout({rate:0.25}));
  m.add(tf.layers.dense({units:12,activation:"relu"}));
  m.add(tf.layers.dense({units:1,activation:"sigmoid"}));
  m.compile({optimizer:tf.train.adam(0.001),loss:"meanSquaredError",metrics:["mae"]});
  return m;
}
function buildFusionNet() {
  const m=tf.sequential();
  m.add(tf.layers.dense({units:128,activation:"relu",inputShape:[N_FUSION_IN],kernelRegularizer:tf.regularizers.l2({l2:0.001})}));
  m.add(tf.layers.batchNormalization());
  m.add(tf.layers.dense({units:64,activation:"relu"}));
  m.add(tf.layers.dropout({rate:0.35}));
  m.add(tf.layers.dense({units:32,activation:"relu"}));
  m.add(tf.layers.dropout({rate:0.2}));
  m.add(tf.layers.dense({units:1,activation:"sigmoid"}));
  m.compile({optimizer:tf.train.adam(0.0008),loss:"meanSquaredError",metrics:["mae"]});
  return m;
}

// ── Main worker handler ───────────────────────────────────────────────────────
self.onmessage = async ({ data }) => {
  if (data.type === "TRAIN") {
    try {
      // Try loading from cache first
      const info = await tf.io.listModels();
      const allSaved = Object.values(MODEL_SAVE_KEYS).every(k => !!info[k]);
      if (allSaved) {
        self.postMessage({ type: "LOADED_FROM_CACHE" });
        return;
      }

      self.postMessage({ type: "STATUS", message: "Generating hybrid clinical dataset..." });
      const preflight = runQuickDatasetValidation(TRAIN_SAMPLES);
      if (preflight.warnings.length) {
        self.postMessage({ type: "STATUS", message: `Dataset warnings: ${preflight.warnings.join(" | ")}` });
      }
      self.postMessage({ type: "STATUS", message: `Dataset class counts: ${preflight.classCounts.join(", ")}` });

      const dataset = generateHybridDataset(TRAIN_SAMPLES);
      const { xs, ys, labels, classCounts } = dataset;
      if (classCounts.length !== 5 || labels.length !== xs.length || ys.length !== xs.length) {
        throw new Error("Hybrid dataset shape mismatch detected before training.");
      }

      const yAll = tf.tensor2d(ys.map(v => [v]));
      const trainHistory = {};

      async function trainModel(name, model, xT) {
        trainHistory[name] = [];
        await model.fit(xT, yAll, {
          epochs: EPOCHS, batchSize: 128, validationSplit: 0.15, shuffle: true,
          callbacks: { onEpochEnd: (ep, logs) => {
            trainHistory[name].push({ epoch: ep+1, loss: +logs.loss.toFixed(4), mae: +(logs.mae||0).toFixed(4) });
            self.postMessage({ type: "PROGRESS", model: name, epoch: ep, total: EPOCHS, loss: logs.loss, mae: logs.mae });
          }},
        });
      }

      const xDep  = tf.tensor2d(xs.map(f=>sliceFeatures(f,DEPNET_FEATURES)));
      const xAnx  = tf.tensor2d(xs.map(f=>sliceFeatures(f,ANXNET_FEATURES)));
      const xSlp  = tf.tensor2d(xs.map(f=>sliceFeatures(f,SLEEPNET_FEATURES)));

      const depNet  = buildDepNet();
      const anxNet  = buildAnxNet();
      const sleepNet = buildSleepNet();

      await trainModel("depnet",   depNet,   xDep);
      await trainModel("anxnet",   anxNet,   xAnx);
      await trainModel("sleepnet", sleepNet, xSlp);

      const dP = depNet.predict(xDep).dataSync();
      const aP = anxNet.predict(xAnx).dataSync();
      const sP = sleepNet.predict(xSlp).dataSync();
      const xFusion = tf.tensor2d(xs.map((f,i)=>[...f,dP[i],aP[i],sP[i]]));
      const fusionNet = buildFusionNet();
      await trainModel("fusionnet", fusionNet, xFusion);

      // Save all models
      await depNet.save(MODEL_SAVE_KEYS.depnet);
      await anxNet.save(MODEL_SAVE_KEYS.anxnet);
      await sleepNet.save(MODEL_SAVE_KEYS.sleepnet);
      await fusionNet.save(MODEL_SAVE_KEYS.fusionnet);

      tf.dispose([yAll, xDep, xAnx, xSlp, xFusion]);

      self.postMessage({ type: "COMPLETE", trainHistory });
    } catch (err) {
      self.postMessage({ type: "ERROR", message: err.message });
    }
  }

  if (data.type === "CLEAR_MODELS") {
    for (const key of Object.values(MODEL_SAVE_KEYS)) {
      try { await tf.io.removeModel(key); } catch {}
    }
    self.postMessage({ type: "MODELS_CLEARED" });
  }
};
