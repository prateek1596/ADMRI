import { generateHybridDataset } from "./ClinicalDataset";
import { assertTrainingDataset } from "./datasetValidation";

export function runQuickDatasetValidation(totalSamples = 6000) {
  const dataset = generateHybridDataset(totalSamples);
  const report = assertTrainingDataset(
    { xs: dataset.xs, ys: dataset.ys, labels: dataset.labels },
    {
      expectedFeatures: 20,
      expectedClasses: 5,
      minSamples: totalSamples,
    }
  );

  return {
    ...report,
    sources: dataset.sources,
    hybridRatio: dataset.hybridRatio,
    classCounts: dataset.classCounts,
  };
}
