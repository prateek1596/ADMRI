// src/utils/exportFHIR.js
// Exports a patient + assessments as HL7 FHIR R4 Bundle (JSON)
// Spec: https://hl7.org/fhir/R4/

export function exportFHIRBundle(patient, assessmentHistory, doctorName) {
  const now       = new Date().toISOString();
  const patientId = `admri-patient-${patient.id}`;
  const entries   = [];

  // ── Patient resource ─────────────────────────────────────────────────────
  entries.push({
    fullUrl:  `urn:uuid:${patientId}`,
    resource: {
      resourceType: "Patient",
      id:           patientId,
      meta:         { profile: ["http://hl7.org/fhir/StructureDefinition/Patient"] },
      text:         { status: "generated", div: `<div>${patient.name}</div>` },
      identifier:   [{ system: "https://admri.in/patient-id", value: patient.id }],
      name:         [{ use: "official", text: patient.name,
                       family: patient.name.split(" ").slice(-1)[0],
                       given:  [patient.name.split(" ")[0]] }],
      gender:       (patient.gender || "unknown").toLowerCase()
                      .replace("male","male").replace("female","female"),
      birthDate:    patient.dob || undefined,
      contact:      patient.guardian ? [{
        relationship: [{ coding:[{ system:"http://terminology.hl7.org/CodeSystem/v2-0131", code:"N" }] }],
        name: { text: patient.guardian },
        telecom: patient.contact ? [{ system:"phone", value: patient.contact }] : [],
      }] : [],
      extension: [{
        url:         "https://admri.in/fhir/extension/diagnosis",
        valueString: patient.diagnosis || "Not specified",
      }],
    },
  });

  // ── Practitioner resource ─────────────────────────────────────────────────
  const practId = "admri-practitioner-1";
  entries.push({
    fullUrl:  `urn:uuid:${practId}`,
    resource: {
      resourceType: "Practitioner",
      id:           practId,
      name: [{ text: doctorName || "Clinician" }],
    },
  });

  // ── Condition (diagnosis) ─────────────────────────────────────────────────
  if (patient.diagnosis) {
    entries.push({
      fullUrl: `urn:uuid:admri-condition-1`,
      resource: {
        resourceType: "Condition",
        id:           "admri-condition-1",
        subject:      { reference: `urn:uuid:${patientId}` },
        recorder:     { reference: `urn:uuid:${practId}` },
        clinicalStatus: {
          coding: [{ system:"http://terminology.hl7.org/CodeSystem/condition-clinical", code:"active" }],
        },
        code: {
          text: patient.diagnosis,
          coding: [{ system:"http://snomed.info/sct", display: patient.diagnosis }],
        },
        recordedDate: patient.joinDate || patient.join_date || now.split("T")[0],
      },
    });
  }

  // ── Observations (one per assessment) ────────────────────────────────────
  (assessmentHistory || []).forEach((a, i) => {
    const obsId   = `admri-obs-${i + 1}`;
    const date    = a.created_at || a.date || now;
    const score   = a.score ?? a.admri_score;

    // Main ADMRI score observation
    entries.push({
      fullUrl: `urn:uuid:${obsId}`,
      resource: {
        resourceType:  "Observation",
        id:            obsId,
        status:        "final",
        category: [{
          coding: [{
            system:  "http://terminology.hl7.org/CodeSystem/observation-category",
            code:    "survey",
            display: "Survey",
          }],
        }],
        code: {
          coding: [{
            system:  "https://admri.in/fhir/CodeSystem/admri-scores",
            code:    "ADMRI-TOTAL",
            display: "ADMRI Total Risk Score",
          }],
          text: "ADMRI Risk Score",
        },
        subject:        { reference: `urn:uuid:${patientId}` },
        performer:      [{ reference: `urn:uuid:${practId}` }],
        effectiveDateTime: new Date(date).toISOString(),
        valueQuantity: {
          value:  score,
          unit:   "score",
          system: "https://admri.in/fhir/units",
          code:   "admri-score",
        },
        interpretation: score != null ? [{
          coding: [{
            system:  "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
            code:    score >= 76 ? "HH" : score >= 61 ? "H" : score >= 41 ? "N" : "L",
            display: score >= 76 ? "Critical High" : score >= 61 ? "High" : score >= 41 ? "Normal" : "Low",
          }],
        }] : undefined,
        component: [
          a.questScore && {
            code: { coding:[{ code:"ADMRI-QUEST", display:"Questionnaire Score" }] },
            valueQuantity: { value: Math.round(a.questScore), unit:"score" },
          },
          a.sentimentScore && {
            code: { coding:[{ code:"ADMRI-SENT", display:"Sentiment Score" }] },
            valueQuantity: { value: Math.round(a.sentimentScore), unit:"score" },
          },
          a.behaviouralScore && {
            code: { coding:[{ code:"ADMRI-BEHAV", display:"Behavioural Score" }] },
            valueQuantity: { value: Math.round(a.behaviouralScore), unit:"score" },
          },
          a.confidence?.confidence && {
            code: { coding:[{ code:"ADMRI-CONF", display:"Confidence Interval" }] },
            valueString: `${a.confidence.lower}–${a.confidence.upper} (${a.confidence.confidence})`,
          },
        ].filter(Boolean),
      },
    });
  });

  // ── Bundle ────────────────────────────────────────────────────────────────
  const bundle = {
    resourceType: "Bundle",
    id:           `admri-export-${patient.id}-${Date.now()}`,
    meta: {
      lastUpdated: now,
      tag: [{ system:"https://admri.in/fhir/tags", code:"admri-export" }],
    },
    type:      "collection",
    timestamp: now,
    total:     entries.length,
    entry:     entries,
  };

  // Download as .json
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type:"application/fhir+json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `ADMRI_FHIR_${patient.name.replace(/\s+/g,"_")}_${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
