/* eslint-disable no-restricted-globals, no-undef */
/**
 * ADMRI Training Web Worker
 * ──────────────────────────
 * Runs TF.js model training off the main thread so the UI stays
 * fully responsive during the ~60-second training process.
 *
 * Usage:
 *   const worker = new Worker(new URL('./ml/trainWorker.js', import.meta.url));
 *   worker.postMessage({ type: 'TRAIN' });
 *   worker.onmessage = ({ data }) => { ... }
 *
 * Messages sent TO worker:   { type: 'TRAIN' } | { type: 'CLEAR_MODELS' }
 * Messages FROM worker:
 *   { type: 'PROGRESS',  model, epoch, total, loss, mae }
 *   { type: 'COMPLETE',  trainHistory }
 *   { type: 'LOADED_FROM_CACHE' }
 *   { type: 'ERROR',     message }
 */

// Import TF.js in worker context
importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js");

const MODEL_SAVE_KEYS = {
  depnet:    "indexeddb://admri-depnet-v3",
  anxnet:    "indexeddb://admri-anxnet-v3",
  sleepnet:  "indexeddb://admri-sleepnet-v3",
  fusionnet: "indexeddb://admri-fusionnet-v3",
};

const N_FEATURES     = 20;
const N_FUSION_IN    = 23;
const TRAIN_SAMPLES  = 6000;
const EPOCHS         = 60;

const DEPNET_FEATURES    = [0,1,2,4,5,11,12,14,18,19];
const ANXNET_FEATURES    = [0,2,3,5,11,12,13,14,15,18,19];
const SLEEPNET_FEATURES  = [3,6,7,8,9,10,15,16,17,18,19];

function sliceFeatures(f, indices) { return indices.map(i => f[i]); }

// ── Inline clinical dataset generator (copied so worker is self-contained) ────
function phq9Risk(items) {
  const t = items.reduce((a,b)=>a+b,0);
  if (t<=4)  return 0.05+(t/4)*0.10;
  if (t<=9)  return 0.15+((t-5)/4)*0.20;
  if (t<=14) return 0.35+((t-10)/4)*0.20;
  if (t<=19) return 0.55+((t-15)/4)*0.20;
  return 0.75+((t-20)/7)*0.25;
}
function gad7Risk(items) {
  const t = items.reduce((a,b)=>a+b,0);
  if (t<=4)  return 0.04+(t/4)*0.10;
  if (t<=9)  return 0.14+((t-5)/4)*0.22;
  if (t<=14) return 0.36+((t-10)/4)*0.24;
  return 0.60+((t-15)/6)*0.40;
}
function isiRisk(sh, sq, fatigue) {
  const sl = sh<6?3:sh<7?2:sh<8?1:0;
  const isi = Math.min(28, sl+sq+(sh<5?3:sh<6?2:0)+Math.max(0,3-Math.floor(sh/4))+fatigue+(fatigue>1?2:1)+sq);
  if (isi<=7)  return 0.05;
  if (isi<=14) return 0.10+((isi-8)/6)*0.25;
  if (isi<=21) return 0.35+((isi-15)/6)*0.30;
  return 0.65+((isi-22)/6)*0.35;
}
function behaviouralRisk(sh, sc, ex, si, app) {
  let s=0;
  if(sh<5)s+=0.30;else if(sh<6)s+=0.20;else if(sh<7)s+=0.12;else if(sh<8)s+=0.05;else if(sh>10)s+=0.06;
  if(sc>8)s+=0.22;else if(sc>5)s+=0.14;else if(sc>3)s+=0.07;
  if(ex<10)s+=0.22;else if(ex<20)s+=0.14;else if(ex<40)s+=0.07;
  if(si===0)s+=0.20;else if(si<2)s+=0.12;else if(si<3)s+=0.04;
  if(app)s+=0.14;
  return Math.min(1,s);
}

function generateDataset(n) {
  const xs=[], ys=[];
  const rand=()=>Math.random();
  const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
  const noise=sd=>{const u=Math.max(1e-10,rand()),v=rand();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)*sd;};
  const CATS=[{lo:0.03,hi:0.20,p:0.28},{lo:0.20,hi:0.45,p:0.32},{lo:0.45,hi:0.65,p:0.25},{lo:0.65,hi:0.82,p:0.10},{lo:0.82,hi:0.98,p:0.05}];
  for(let i=0;i<n;i++){
    let r=rand(),cum=0,cat=CATS[0];
    for(const c of CATS){cum+=c.p;if(r<cum){cat=c;break;}}
    const base=cat.lo+rand()*(cat.hi-cat.lo);
    const rf=base;
    const age=10+Math.floor(rand()*9);
    const phqM=rf*27/3;
    const gadM=rf*21/3;
    const phq9=Array(9).fill(0).map(()=>Math.min(3,Math.max(0,Math.round((phqM/9+noise(0.85))*1))));
    const gad7=Array(7).fill(0).map(()=>Math.min(3,Math.max(0,Math.round((gadM/7+noise(0.9))*1))));
    const sh=clamp(8.5-rf*5+noise(1.2),2,12);
    const sc=clamp(rf*8+noise(2),0,14);
    const ex=clamp(60-rf*50+noise(15),0,120);
    const si=clamp(5-rf*4+noise(1.5),0,10);
    const app=rand()<rf*0.58;
    const phqR=phq9Risk(phq9);
    const gadR=gad7Risk(gad7);
    const isiR=isiRisk(sh,phq9[2],phq9[3]);
    const scaredR=Math.min(1,gadR*1.1);
    const behavR=behaviouralRisk(sh,sc,ex,si,app);
    const label=clamp(0.30*phqR+0.25*gadR+0.20*isiR+0.15*scaredR+0.10*behavR+noise(0.025));
    const qA={q1:phq9[0],q2:phq9[1],q3:phq9[2],q4:phq9[3],q5:phq9[4],q6:phq9[5],q7:phq9[6],q8:gad7[0],q9:gad7[1],q10:gad7[2]};
    const sub=keys=>keys.map(k=>qA[k]).reduce((a,b)=>a+b,0)/(keys.length*3);
    const totalNorm=Object.values(qA).reduce((a,b)=>a+b,0)/(10*3);
    const deprNorm=sub(["q1","q2","q6"]);
    const anxNorm=sub(["q8","q9","q10"]);
    const sleepQNorm=sub(["q3","q4"]);
    const somaticNorm=sub(["q5"]);
    const cogNorm=sub(["q7"]);
    const sleepRisk=clamp((8-sh)/6);
    const screenRisk=Math.min(1,sc/12);
    const exerRisk=clamp((60-ex)/60);
    const socialRisk=clamp((5-si)/5);
    const appetiteR=app?1:0;
    const sentNorm=clamp(label*0.82+noise(0.18));
    const sentVar=clamp(label*0.6+noise(0.3));
    const ageNorm=(age-10)/8;
    xs.push([totalNorm,deprNorm,anxNorm,sleepQNorm,somaticNorm,cogNorm,sleepRisk,screenRisk,exerRisk,socialRisk,appetiteR,sentNorm,sentVar,ageNorm,deprNorm*anxNorm,sleepRisk*sentNorm,(sleepRisk+screenRisk+exerRisk+socialRisk+appetiteR)/5,somaticNorm*sleepRisk,0,0]);
    ys.push([label]);
  }
  return {xs,ys};
}

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

      self.postMessage({ type: "STATUS", message: "Generating clinical dataset..." });
      const { xs, ys } = generateDataset(TRAIN_SAMPLES);
      const xAll = tf.tensor2d(xs);
      const yAll = tf.tensor2d(ys);
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

      tf.dispose([xAll,yAll,xDep,xAnx,xSlp,xFusion]);

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
