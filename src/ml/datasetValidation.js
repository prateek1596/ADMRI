export function validateTrainingDataset({ xs, ys, labels }, options = {}) {
  const expectedFeatures = options.expectedFeatures ?? 20;
  const expectedClasses = options.expectedClasses ?? 5;
  const minSamples = options.minSamples ?? 500;

  const errors = [];
  const warnings = [];

  if (!Array.isArray(xs) || !Array.isArray(ys) || !Array.isArray(labels)) {
    errors.push("Dataset must include array fields: xs, ys, labels.");
    return { ok: false, errors, warnings, summary: null };
  }

  if (xs.length < minSamples) {
    errors.push(`Expected at least ${minSamples} samples, got ${xs.length}.`);
  }

  if (!(xs.length === ys.length && ys.length === labels.length)) {
    errors.push(`Length mismatch: xs=${xs.length}, ys=${ys.length}, labels=${labels.length}.`);
  }

  for (let i = 0; i < xs.length; i++) {
    const row = xs[i];
    if (!Array.isArray(row)) {
      errors.push(`Row ${i} is not an array.`);
      break;
    }
    if (row.length !== expectedFeatures) {
      errors.push(`Row ${i} has ${row.length} features; expected ${expectedFeatures}.`);
      break;
    }
    if (row.some((v) => typeof v !== "number" || !Number.isFinite(v))) {
      errors.push(`Row ${i} contains non-finite values.`);
      break;
    }

    const target = ys[i];
    if (typeof target !== "number" || !Number.isFinite(target) || target < 0 || target > 1) {
      errors.push(`Target ys[${i}] is out of range [0,1]: ${target}`);
      break;
    }

    const label = labels[i];
    if (!Number.isInteger(label) || label < 0 || label >= expectedClasses) {
      errors.push(`Label labels[${i}] is invalid for ${expectedClasses} classes: ${label}`);
      break;
    }
  }

  const classCounts = Array.from({ length: expectedClasses }, (_, c) =>
    labels.reduce((acc, v) => (v === c ? acc + 1 : acc), 0)
  );

  classCounts.forEach((count, idx) => {
    if (count === 0) {
      warnings.push(`Class ${idx} has 0 samples.`);
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      samples: xs.length,
      features: xs[0]?.length ?? 0,
      classCounts,
      targetRange: {
        min: ys.length ? Math.min(...ys) : null,
        max: ys.length ? Math.max(...ys) : null,
      },
    },
  };
}

export function assertTrainingDataset(dataset, options = {}) {
  const report = validateTrainingDataset(dataset, options);
  if (!report.ok) {
    throw new Error(`Dataset validation failed: ${report.errors.join(" ")}`);
  }
  return report;
}
