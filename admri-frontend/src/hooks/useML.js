import { useState, useEffect, useRef } from "react";
import { mlEngine } from "../ml/ADMRIEngine";

const MODEL_NAMES = {
  depnet:    "DepNet — PHQ-9 Depression",
  anxnet:    "AnxNet — GAD-7 Anxiety",
  sleepnet:  "SleepNet — ISI Sleep / Behaviour",
  fusionnet: "FusionNet — Ensemble Meta-Learner",
};

/**
 * Manages 4-model TF.js training lifecycle.
 * Training runs in a Web Worker (off main thread) so the UI stays smooth.
 * On first visit: trains fresh (~60s) and saves to IndexedDB.
 * On return visits: loads from IndexedDB instantly (<1s).
 */
export function useML() {
  const [trained,       setTrained]       = useState(false);
  const [training,      setTraining]      = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [fromCache,     setFromCache]     = useState(false);
  const [currentModel,  setCurrentModel]  = useState(null);
  const [modelProgress, setModelProgress] = useState({});
  const [trainLogs,     setTrainLogs]     = useState({});
  const [error,         setError]         = useState(null);
  const [workerReady,   setWorkerReady]   = useState(false);
  const workerRef = useRef(null);
  const started   = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function init() {
      setLoading(true);

      // Try loading saved models directly into mlEngine first
      const loaded = await mlEngine.loadSavedModels();
      if (loaded) {
        setFromCache(true);
        setTrained(true);
        setLoading(false);
        return;
      }

      setLoading(false);
      setTraining(true);

      // Attempt Web Worker training
      try {
        const worker = new Worker(new URL("../ml/trainWorker.js", import.meta.url));
        workerRef.current = worker;
        setWorkerReady(true);

        worker.onmessage = async ({ data }) => {
          switch (data.type) {
            case "LOADED_FROM_CACHE":
              // Worker confirmed cache exists — load into mlEngine on main thread
              await mlEngine.loadSavedModels();
              setFromCache(true);
              setTrained(true);
              setTraining(false);
              setLoading(false);
              worker.terminate();
              break;

            case "PROGRESS":
              setCurrentModel(data.model);
              setModelProgress(prev => ({
                ...prev,
                [data.model]: Math.round(((data.epoch + 1) / data.total) * 100),
              }));
              setTrainLogs(prev => ({
                ...prev,
                [data.model]: [
                  ...(prev[data.model] || []),
                  { epoch: data.epoch + 1, loss: +(data.loss||0).toFixed(4), mae: +(data.mae||0).toFixed(4) },
                ],
              }));
              break;

            case "COMPLETE":
              // Worker saved models to IndexedDB — now load into mlEngine on main thread
              await mlEngine.loadSavedModels();
              setTrained(true);
              setTraining(false);
              setCurrentModel(null);
              // Merge train logs from worker
              if (data.trainHistory) {
                setTrainLogs(data.trainHistory);
              }
              worker.terminate();
              break;

            case "ERROR":
              console.warn("[Worker] Training error, falling back to main thread:", data.message);
              worker.terminate();
              await fallbackMainThreadTrain();
              break;

            default: break;
          }
        };

        worker.onerror = async (e) => {
          console.warn("[Worker] Worker failed, falling back to main thread:", e);
          worker.terminate();
          await fallbackMainThreadTrain();
        };

        worker.postMessage({ type: "TRAIN" });

      } catch (workerErr) {
        // Web Workers not available (e.g. some older browsers)
        console.warn("[ADMRI] Web Worker unavailable, training on main thread:", workerErr);
        await fallbackMainThreadTrain();
      }
    }

    async function fallbackMainThreadTrain() {
      setWorkerReady(false);
      try {
        await mlEngine.train((modelName, epoch, total, logs) => {
          setCurrentModel(modelName);
          if (total > 0) {
            setModelProgress(prev => ({
              ...prev,
              [modelName]: Math.round(((epoch + 1) / total) * 100),
            }));
          }
          if (logs.loss !== undefined) {
            setTrainLogs(prev => ({
              ...prev,
              [modelName]: [
                ...(prev[modelName] || []),
                { epoch: epoch+1, loss: +logs.loss.toFixed(4), mae: +(logs.mae||0).toFixed(4) },
              ],
            }));
          }
        });
        setTrained(true);
      } catch (err) {
        console.error("Training failed completely:", err);
        setError("Training failed. Using fallback linear predictor.");
        setTrained(true);
      } finally {
        setTraining(false);
        setCurrentModel(null);
      }
    }

    init();

    return () => { workerRef.current?.terminate(); };
  }, []);

  const overallProgress = Object.keys(MODEL_NAMES).reduce((sum, name) => {
    return sum + (modelProgress[name] || 0);
  }, 0) / 4;

  async function forceRetrain() {
    await mlEngine.clearSavedModels();
    window.location.reload();
  }

  return {
    trained, training, loading, fromCache, error,
    currentModel,
    currentModelLabel: MODEL_NAMES[currentModel] || "",
    modelProgress,
    trainLogs,
    overallProgress: Math.round(overallProgress),
    modelNames: MODEL_NAMES,
    workerUsed: workerReady,
    forceRetrain,
  };
}
