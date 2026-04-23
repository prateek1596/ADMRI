export const SEED_DOCTORS = [
  {
    id: "doc_001",
    name: "Dr. Priya Sharma",
    email: "priya@admri.in",
    password: "doctor123",
    specialty: "Child Psychiatry",
    licenseNo: "MCI-10234",
  },
  {
    id: "doc_002",
    name: "Dr. Arjun Mehta",
    email: "arjun@admri.in",
    password: "doctor456",
    specialty: "Clinical Psychology",
    licenseNo: "MCI-20567",
  },
];

export const SEED_PATIENTS = [
  {
    id: "pat_001",
    name: "Aarav Singh",
    age: 14,
    gender: "Male",
    diagnosis: "Anxiety Disorder",
    doctorId: "doc_001",
    joinDate: "2025-09-15",
    contact: "+91 98765 43210",
    guardian: "Rajesh Singh",
    riskHistory: [65, 70, 58, 72, 61],
  },
  {
    id: "pat_002",
    name: "Meera Patel",
    age: 12,
    gender: "Female",
    diagnosis: "Depression",
    doctorId: "doc_001",
    joinDate: "2025-10-02",
    contact: "+91 87654 32109",
    guardian: "Sunita Patel",
    riskHistory: [78, 82, 75, 68, 60],
  },
  {
    id: "pat_003",
    name: "Kiran Reddy",
    age: 16,
    gender: "Male",
    diagnosis: "ADHD + Anxiety",
    doctorId: "doc_001",
    joinDate: "2025-11-20",
    contact: "+91 76543 21098",
    guardian: "Lakshmi Reddy",
    riskHistory: [55, 60, 52, 48, 45],
  },
  {
    id: "pat_004",
    name: "Ananya Nair",
    age: 13,
    gender: "Female",
    diagnosis: "Social Anxiety",
    doctorId: "doc_002",
    joinDate: "2025-08-05",
    contact: "+91 65432 10987",
    guardian: "Vinod Nair",
    riskHistory: [80, 74, 69, 65, 58],
  },
  {
    id: "pat_005",
    name: "Rohan Gupta",
    age: 15,
    gender: "Male",
    diagnosis: "Adjustment Disorder",
    doctorId: "doc_002",
    joinDate: "2025-12-01",
    contact: "+91 54321 09876",
    guardian: "Priti Gupta",
    riskHistory: [45, 50, 42, 38, 35],
  },
];

export const SEED_NOTES = [
  {
    id: "note_001",
    patientId: "pat_001",
    doctorId: "doc_001",
    date: "2025-02-10",
    type: "Session",
    mood: "Anxious",
    content:
      "Patient reported increased school-related anxiety. Introduced 4-7-8 breathing exercises and grounding techniques. Homework: complete thought record daily for one week.",
    tags: ["anxiety", "school", "cbt", "breathing"],
  },
  {
    id: "note_002",
    patientId: "pat_001",
    doctorId: "doc_001",
    date: "2025-01-28",
    type: "Check-in",
    mood: "Neutral",
    content:
      "Follow-up after medication adjustment. Sleep improving to 7 hrs. Still avoiding social situations at school. Discussed graduated exposure plan.",
    tags: ["medication", "sleep", "avoidance"],
  },
  {
    id: "note_003",
    patientId: "pat_002",
    doctorId: "doc_001",
    date: "2025-02-14",
    type: "Session",
    mood: "Sad",
    content:
      "Meera disclosed feelings of hopelessness related to academic pressure. Explored cognitive distortions — catastrophising and all-or-nothing thinking. Parents informed. Safety contract signed.",
    tags: ["depression", "academics", "safety", "family"],
  },
  {
    id: "note_004",
    patientId: "pat_003",
    doctorId: "doc_001",
    date: "2025-02-05",
    type: "Assessment",
    mood: "Hyperactive",
    content:
      "Initial ADHD assessment. Significant executive function deficits noted. Referred to neuropsychologist. Started psychoeducation with family.",
    tags: ["adhd", "assessment", "referral", "family"],
  },
  {
    id: "note_005",
    patientId: "pat_004",
    doctorId: "doc_002",
    date: "2025-02-12",
    type: "Session",
    mood: "Anxious",
    content:
      "Gradual exposure hierarchy constructed. Ananya was receptive. Practiced role-play for ordering food. Assigned: initiate one conversation with a classmate this week.",
    tags: ["social anxiety", "exposure", "cbt", "homework"],
  },
  {
    id: "note_006",
    patientId: "pat_005",
    doctorId: "doc_002",
    date: "2025-02-08",
    type: "Check-in",
    mood: "Hopeful",
    content:
      "Rohan showing significant improvement. Academic stress decreasing. Sleep normalized. Family dynamics improving after parent coaching sessions.",
    tags: ["improvement", "family", "sleep"],
  },
];

export const CBT_LIBRARY = {
  anxiety: [
    {
      title: "4-7-8 Breathing Protocol",
      category: "Somatic",
      description:
        "Inhale 4s → hold 7s → exhale 8s. Activates parasympathetic nervous system. Evidence: RCT n=60, reduces cortisol 23%.",
      duration: "5 min",
      evidence: "High",
    },
    {
      title: "Cognitive Restructuring",
      category: "Cognitive",
      description:
        "Identify automatic negative thoughts, challenge distortions like catastrophising. Replace with balanced alternatives using a thought record.",
      duration: "15 min",
      evidence: "High",
    },
    {
      title: "Grounding 5-4-3-2-1",
      category: "Mindfulness",
      description:
        "Name 5 things you see, 4 you feel, 3 you hear, 2 you smell, 1 you taste. Interrupts amygdala hijack loop.",
      duration: "3 min",
      evidence: "Moderate",
    },
  ],
  depression: [
    {
      title: "Behavioral Activation Schedule",
      category: "Behavioral",
      description:
        "Schedule 2 pleasurable + 1 achievement activity daily. Breaks withdrawal-mood cycle. Backed by 47 RCTs in meta-analysis.",
      duration: "Daily",
      evidence: "High",
    },
    {
      title: "Gratitude Journaling",
      category: "Positive Psychology",
      description:
        "Write 3 specific, novel gratitudes nightly. Engages prefrontal cortex, counters negativity bias.",
      duration: "10 min",
      evidence: "Moderate",
    },
    {
      title: "Interpersonal Connection Micro-task",
      category: "Social",
      description:
        "One genuine connection daily. Oxytocin release counters isolation spiral common in adolescent depression.",
      duration: "5 min",
      evidence: "Moderate",
    },
  ],
  stress: [
    {
      title: "Progressive Muscle Relaxation",
      category: "Somatic",
      description:
        "Systematically tense and release 16 muscle groups. Reduces muscle tension biomarkers by 35% in trials.",
      duration: "20 min",
      evidence: "High",
    },
    {
      title: "Problem-Solving Therapy (PST)",
      category: "Cognitive",
      description:
        "SOLVE framework: State → Options → List pros/cons → Vote → Execute. Converts rumination into action.",
      duration: "30 min",
      evidence: "High",
    },
  ],
};

export const QUESTIONS = [
  { id: "q1",  text: "Little interest or pleasure in doing things",                        domain: "depression" },
  { id: "q2",  text: "Feeling down, depressed, or hopeless",                               domain: "depression" },
  { id: "q3",  text: "Trouble falling or staying asleep, or sleeping too much",            domain: "sleep"      },
  { id: "q4",  text: "Feeling tired or having little energy",                              domain: "fatigue"    },
  { id: "q5",  text: "Poor appetite or overeating",                                        domain: "somatic"    },
  { id: "q6",  text: "Feeling bad about yourself — feeling like a failure",                domain: "self-esteem"},
  { id: "q7",  text: "Trouble concentrating on things",                                    domain: "cognitive"  },
  { id: "q8",  text: "Feeling nervous, anxious, or on edge",                               domain: "anxiety"    },
  { id: "q9",  text: "Not being able to stop or control worrying",                         domain: "anxiety"    },
  { id: "q10", text: "Feeling afraid, as if something awful might happen",                 domain: "anxiety"    },
];

export const OPTIONS = [
  { label: "Not at all",        value: 0 },
  { label: "Several days",      value: 1 },
  { label: "More than half",    value: 2 },
  { label: "Nearly every day",  value: 3 },
];
