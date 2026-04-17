# ADMRI Dataset Documentation

## 1. What This Covers

This document explains the ADMRI dataset end to end:

- where the data design comes from
- how samples are generated
- how labels are mapped
- how data is validated before training
- how and when training runs
- what is stored in IndexedDB
- where dataset logic is used in the app
- how the chatbot intent dataset is handled

## 2. Dataset Origin: Where It Comes From

ADMRI does not ship a raw CSV of real patient records.

Instead, the training dataset is generated in code as a hybrid of:

- real published clinical score distributions (means, SDs, prevalence) from literature
- synthetic augmentation to improve coverage of edge cases
- SMOTE-inspired minority oversampling for harder classes

Primary source definitions are implemented in [src/ml/ClinicalDataset.js](src/ml/ClinicalDataset.js).

The file-level comments list the clinical sources used for distribution design, including DASS-21, PHQ-A, SMFQ, RCADS-25, SDQ, SCARED, and ALSPAC-related norms.

## 3. Main Hybrid Dataset Structure

The training dataset is produced by generateHybridDataset in [src/ml/ClinicalDataset.js](src/ml/ClinicalDataset.js#L416).

It merges 5 sub-datasets:

1. DASS-21 hybrid
2. SMFQ hybrid
3. RCADS-25 hybrid
4. SDQ + ALSPAC hybrid
5. ADMRI primary synthetic anchor set

Default generation split inside generateHybridDataset(totalN) is:

- 20% DASS-21 hybrid
- 18% SMFQ hybrid
- 22% RCADS-25 hybrid
- 24% SDQ + ALSPAC hybrid
- 16% ADMRI primary

Each row is normalized to 20 features. If a source row is shorter, it is zero-padded; if longer, it is truncated. See normalise20 in [src/ml/ClinicalDataset.js](src/ml/ClinicalDataset.js#L404).

## 4. Labels and Targets

Internal training uses two label forms:

- labels: integer class on 5-level ADMRI scale [0..4]
- ys: scaled regression target labels/4 in range [0..1]

Label mapping across source datasets:

- 4-class source mapped by round(l * 4 / 3)
- 3-class source mapped as [0, 2, 4]
- binary source mapped as 0 or 3

Mapping logic is in [src/ml/ClinicalDataset.js](src/ml/ClinicalDataset.js#L424).

## 5. Feature Vector Used for ML Training

The ensemble is trained on 20 engineered features.

Feature creation for runtime inference uses extractFeatures in [src/ml/ADMRIEngine.js](src/ml/ADMRIEngine.js#L113).

Feature order (20D):

1. total questionnaire normalized
2. depression subscore normalized
3. anxiety subscore normalized
4. sleep questionnaire normalized
5. somatic normalized
6. cognitive normalized
7. sleep risk
8. screen-time risk
9. exercise risk
10. social risk
11. appetite-change risk
12. sentiment normalized
13. sentiment variance
14. age normalized
15. depression x anxiety interaction
16. sleep x sentiment interaction
17. total behavioural risk
18. somatic x sleep interaction
19. risk trend feature
20. session-count feature

## 6. Data Validation Before Training

Before training, the app validates dataset shape and ranges:

- expected features per row: 20
- expected classes: 5
- expected sample count: at least requested total
- ys must be numeric in [0,1]
- labels must be integer in [0..4]

Validation entry point:

- runQuickDatasetValidation in [src/ml/quickValidateDataset.js](src/ml/quickValidateDataset.js)

Core validator:

- validateTrainingDataset in [src/ml/datasetValidation.js](src/ml/datasetValidation.js)

## 7. How the Dataset Is Loaded for Training

There are two training paths.

### Path A: Cached model load (fast path)

On app start, useML first attempts to load pre-trained models from IndexedDB via mlEngine.loadSavedModels.

Reference: [src/hooks/useML.js](src/hooks/useML.js#L38)

If successful, no dataset generation or retraining is needed.

### Path B: New training run (cold start)

If no cached models are found:

1. useML starts a Web Worker for training
2. worker runs runQuickDatasetValidation(TRAIN_SAMPLES)
3. worker generates generateHybridDataset(TRAIN_SAMPLES)
4. worker trains all 4 models
5. worker saves models to IndexedDB
6. main thread loads saved models into mlEngine

References:

- worker flow in [src/ml/trainWorker.js](src/ml/trainWorker.js#L83)
- main-thread fallback in [src/hooks/useML.js](src/hooks/useML.js#L97)
- main-thread training in [src/ml/ADMRIEngine.js](src/ml/ADMRIEngine.js#L277)

## 8. What Is Indexed and Stored

The dataset itself is generated in memory and used during fitting. It is not persisted as a local dataset table.

What is persisted is model artifacts in IndexedDB:

- indexeddb://admri-depnet-v3
- indexeddb://admri-anxnet-v3
- indexeddb://admri-sleepnet-v3
- indexeddb://admri-fusionnet-v3

Definitions:

- [src/ml/ADMRIEngine.js](src/ml/ADMRIEngine.js#L25)
- [src/ml/trainWorker.js](src/ml/trainWorker.js#L13)

So, main indexed storage is model cache, not raw dataset rows.

## 9. How Dataset Is Used in ML Training

The generated xs/ys arrays feed a 4-model ensemble:

1. DepNet trains on depression-focused feature slice
2. AnxNet trains on anxiety-focused feature slice
3. SleepNet trains on sleep/behaviour slice
4. FusionNet trains on all 20 features plus the 3 sub-model outputs (stacked generalization)

Training pipeline reference:

- [src/ml/ADMRIEngine.js](src/ml/ADMRIEngine.js#L297)

The worker uses equivalent architecture and sequence:

- [src/ml/trainWorker.js](src/ml/trainWorker.js#L117)

## 10. Runtime Inference vs Training Dataset

At prediction time, the app does not load a stored training dataset. It computes the 20 features from current assessment inputs and feeds the saved models.

Inference entry points:

- predict in [src/ml/ADMRIEngine.js](src/ml/ADMRIEngine.js#L385)
- predictWithConfidence in [src/ml/ADMRIEngine.js](src/ml/ADMRIEngine.js#L399)

Confidence is estimated with Monte Carlo dropout (multiple stochastic forward passes).

## 11. Additional Dataset in This Repo: Chatbot Intent Data

There is also a separate NLP intent dataset in [src/ml/ClinicalDataset.js](src/ml/ClinicalDataset.js#L472):

- INTENT_TRAINING_DATA (labeled utterances)
- intents: anxiety, depression, sleep, social, crisis, grounding, positive, general

It trains a small in-memory bag-of-words classifier.

Usage in UI:

- intent model train call in [src/components/chat/ADMRIChatbot.jsx](src/components/chat/ADMRIChatbot.jsx#L423)
- prediction call in [src/components/chat/ADMRIChatbot.jsx](src/components/chat/ADMRIChatbot.jsx#L471)

This intent model is separate from the 4-model clinical risk ensemble.

## 12. Privacy and Data Handling Notes

- Clinical training rows are synthetic/hybrid programmatic samples.
- Model caching is local (browser IndexedDB).
- No backend dataset download is required for training.
- No server-side model inference is required for scoring.

## 13. Quick Reference

- Dataset generator: [src/ml/ClinicalDataset.js](src/ml/ClinicalDataset.js)
- Dataset validation: [src/ml/datasetValidation.js](src/ml/datasetValidation.js)
- Validation wrapper: [src/ml/quickValidateDataset.js](src/ml/quickValidateDataset.js)
- ML engine training: [src/ml/ADMRIEngine.js](src/ml/ADMRIEngine.js)
- Worker training: [src/ml/trainWorker.js](src/ml/trainWorker.js)
- App ML lifecycle: [src/hooks/useML.js](src/hooks/useML.js)
- Chatbot intent usage: [src/components/chat/ADMRIChatbot.jsx](src/components/chat/ADMRIChatbot.jsx)