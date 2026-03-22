// seed.js — Run with: node seed.js
// Restores all demo doctors, patients, notes, and assessments to PostgreSQL
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'admri_db',
  user:     process.env.DB_USER     || 'admri_user',
  password: process.env.DB_PASSWORD || 'admri123',
});

async function seed() {
  console.log('Seeding ADMRI demo data...\n');

  // ── DOCTORS ──────────────────────────────────────────────────────────────────
  const hash123 = await bcrypt.hash('doctor123', 12);
  const hash456 = await bcrypt.hash('doctor456', 12);

  const priyaId = uuidv4();
  const arjunId = uuidv4();

  await pool.query(`
    INSERT INTO doctors (id, name, email, password_hash, specialty, license_number)
    VALUES
      ($1, 'Dr. Priya Sharma', 'priya@admri.in', $2, 'Child Psychiatry',    'MCI-PRI-001'),
      ($3, 'Dr. Arjun Mehta',  'arjun@admri.in', $4, 'Clinical Psychology', 'MCI-ARJ-002')
    ON CONFLICT (email) DO UPDATE
      SET name = EXCLUDED.name,
          password_hash = EXCLUDED.password_hash,
          specialty = EXCLUDED.specialty
    RETURNING email
  `, [priyaId, hash123, arjunId, hash456]);

  // Fetch actual IDs (in case of conflict/update)
  const priyaRes = await pool.query(`SELECT id FROM doctors WHERE email = 'priya@admri.in'`);
  const arjunRes = await pool.query(`SELECT id FROM doctors WHERE email = 'arjun@admri.in'`);
  const PRIYA = priyaRes.rows[0].id;
  const ARJUN = arjunRes.rows[0].id;

  console.log('✅ Doctors created');
  console.log('   priya@admri.in  → password: doctor123');
  console.log('   arjun@admri.in  → password: doctor456\n');

  // ── PATIENTS (assigned to Priya) ─────────────────────────────────────────────
  const p1Id = uuidv4();
  const p2Id = uuidv4();
  const p3Id = uuidv4();
  const p4Id = uuidv4();
  const p5Id = uuidv4();

  await pool.query(`
    INSERT INTO patients (id, doctor_id, name, age, gender, diagnosis, guardian, contact,
                          latest_score, risk_level, risk_history, join_date)
    VALUES
      ($1,  $2,  'Aarav Sharma',    12, 'Male',   'Generalised Anxiety Disorder',
       'Meera Sharma',   '9876543210', 61, 'High',
       '{45,52,58,61}', '2024-08-15'),

      ($3,  $2,  'Priya Nair',      14, 'Female', 'Major Depressive Disorder',
       'Suresh Nair',    '9123456780', 74, 'High',
       '{38,45,55,63,70,74}', '2024-06-10'),

      ($4,  $2,  'Rohan Desai',     10, 'Male',   'ADHD with Anxiety',
       'Kavita Desai',   '9988776655', 38, 'Mild',
       '{72,65,55,48,38}', '2024-07-22'),

      ($5,  $2,  'Ananya Krishnan', 15, 'Female', 'Separation Anxiety Disorder',
       'Vijay Krishnan', '9012345678', 29, 'Mild',
       '{55,48,40,35,29}', '2024-09-01'),

      ($6,  $2,  'Dev Mehta',       13, 'Male',   'Social Anxiety Disorder',
       'Rina Mehta',     '9876001234', 82, 'Severe',
       '{55,60,68,75,82}', '2024-05-20')
    ON CONFLICT (id) DO NOTHING
  `, [p1Id, PRIYA, p2Id, p3Id, p4Id, p5Id]);

  console.log('✅ Patients created (5 patients for Dr. Priya)\n');

  // ── ASSESSMENTS ──────────────────────────────────────────────────────────────
  const assessments = [
    // Aarav Sharma — High risk, gradual increase
    { pid: p1Id, score: 45, risk: 'Moderate', qs: 42, ss: 55, bs: 38, journal: 'I have been feeling okay but school stress is getting to me.', days: 90 },
    { pid: p1Id, score: 52, risk: 'Moderate', qs: 50, ss: 48, bs: 45, journal: 'I worry a lot before exams. My stomach hurts when I think about going to school.', days: 60 },
    { pid: p1Id, score: 58, risk: 'Moderate', qs: 55, ss: 42, bs: 52, journal: 'I have been having trouble sleeping. I keep thinking about bad things happening.', days: 30 },
    { pid: p1Id, score: 61, risk: 'High',     qs: 60, ss: 38, bs: 58, journal: 'Everything feels scary. I cannot stop worrying even when nothing is happening. My heart races sometimes.', days: 7 },

    // Priya Nair — High risk, worsening trend
    { pid: p2Id, score: 38, risk: 'Mild',     qs: 35, ss: 60, bs: 30, journal: 'Things have been okay. I feel a bit sad sometimes but nothing too bad.', days: 150 },
    { pid: p2Id, score: 45, risk: 'Moderate', qs: 42, ss: 50, bs: 40, journal: 'I have been feeling down for the past few weeks. Not enjoying things I used to.', days: 120 },
    { pid: p2Id, score: 55, risk: 'Moderate', qs: 52, ss: 45, bs: 48, journal: 'I feel empty inside. Nothing feels worth doing. I have been sleeping too much.', days: 90 },
    { pid: p2Id, score: 63, risk: 'High',     qs: 60, ss: 35, bs: 58, journal: 'I feel worthless. I do not see the point of trying anymore. Everything is grey.', days: 60 },
    { pid: p2Id, score: 70, risk: 'High',     qs: 68, ss: 28, bs: 65, journal: 'I have been crying a lot. I feel like nobody cares about me. I cannot concentrate on anything.', days: 30 },
    { pid: p2Id, score: 74, risk: 'High',     qs: 72, ss: 25, bs: 68, journal: 'I feel hopeless. I do not want to go to school or talk to anyone. I feel like a burden.', days: 5 },

    // Rohan Desai — Improving trend
    { pid: p3Id, score: 72, risk: 'High',     qs: 70, ss: 35, bs: 68, journal: 'I cannot sit still. My mind goes too fast. I feel scared and angry at the same time.', days: 120 },
    { pid: p3Id, score: 65, risk: 'High',     qs: 62, ss: 42, bs: 60, journal: 'A bit better after starting therapy. Still hard to focus but I feel less scared.', days: 90 },
    { pid: p3Id, score: 55, risk: 'Moderate', qs: 52, ss: 50, bs: 52, journal: 'I managed to sit through a full class today. Felt proud of that.', days: 60 },
    { pid: p3Id, score: 48, risk: 'Moderate', qs: 45, ss: 58, bs: 45, journal: 'Things are getting better slowly. I still get anxious but I can calm down faster now.', days: 30 },
    { pid: p3Id, score: 38, risk: 'Mild',     qs: 35, ss: 65, bs: 38, journal: 'I had a good week. I made a new friend at school. I feel much lighter.', days: 3 },

    // Ananya Krishnan — Steadily improving
    { pid: p4Id, score: 55, risk: 'Moderate', qs: 52, ss: 45, bs: 50, journal: 'I get very scared when my parents leave. I cry a lot and cannot sleep alone.', days: 120 },
    { pid: p4Id, score: 48, risk: 'Moderate', qs: 45, ss: 52, bs: 44, journal: 'Slightly better. I tried staying in my room alone for 10 minutes today.', days: 90 },
    { pid: p4Id, score: 40, risk: 'Mild',     qs: 38, ss: 58, bs: 40, journal: 'I am getting better at staying calm when parents go out. Using the breathing exercise.', days: 60 },
    { pid: p4Id, score: 35, risk: 'Mild',     qs: 32, ss: 62, bs: 35, journal: 'I went to a friend birthday party without my parents. I was nervous but I did it.', days: 30 },
    { pid: p4Id, score: 29, risk: 'Mild',     qs: 28, ss: 70, bs: 28, journal: 'Feeling much better. I am not so scared anymore when I am alone. Progress!', days: 4 },

    // Dev Mehta — Severe, escalating
    { pid: p5Id, score: 55, risk: 'Moderate', qs: 52, ss: 40, bs: 50, journal: 'I do not like being around people. I get very nervous when people look at me.', days: 120 },
    { pid: p5Id, score: 60, risk: 'High',     qs: 58, ss: 35, bs: 55, journal: 'I avoided school again today. I cannot face people. It feels impossible.', days: 90 },
    { pid: p5Id, score: 68, risk: 'High',     qs: 65, ss: 28, bs: 62, journal: 'I have not spoken to anyone except my parents in 2 weeks. I feel invisible and scared.', days: 60 },
    { pid: p5Id, score: 75, risk: 'High',     qs: 72, ss: 22, bs: 70, journal: 'I feel like everyone is judging me. I cannot eat in front of others. I want to disappear.', days: 30 },
    { pid: p5Id, score: 82, risk: 'Severe',   qs: 80, ss: 18, bs: 78, journal: 'Everything is too much. I cannot leave my room. I feel like no one would miss me if I was gone.', days: 2 },
  ];

  for (const a of assessments) {
    const date = new Date();
    date.setDate(date.getDate() - a.days);
    await pool.query(`
      INSERT INTO assessments (
        id, patient_id, admri_score, risk_level,
        quest_score, sentiment_score, behavioural_score,
        confidence_mean, confidence_lower, confidence_upper, confidence_label,
        journal_text, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO NOTHING
    `, [
      uuidv4(), a.pid, a.score, a.risk,
      a.qs, a.ss, a.bs,
      a.score, Math.max(a.score - 8, 0), Math.min(a.score + 8, 100), 'High',
      a.journal, date.toISOString(),
    ]);
  }

  console.log('✅ Assessments created (25 assessments across 5 patients)\n');

  // ── NOTES ─────────────────────────────────────────────────────────────────────
  const notes = [
    // Aarav Sharma
    { pid: p1Id, content: 'Initial assessment. Aarav presents with generalised anxiety symptoms primarily around academic performance. Mother reports he has been refusing school 2-3 days per week. Recommended CBT workbook and breathing exercises.', type: 'Session', mood: 'Anxious', tags: ['CBT', 'school-refusal', 'breathing'], days: 90 },
    { pid: p1Id, content: 'Follow-up session. Aarav has been practising box breathing. Slight improvement in school attendance — only missed 1 day last week. Introduced thought challenging worksheet.', type: 'Session', mood: 'Neutral', tags: ['CBT', 'thought-challenging', 'progress'], days: 60 },
    { pid: p1Id, content: 'Parent check-in call with Meera Sharma. Reports Aarav is more irritable at home and not sleeping well. Discussed sleep hygiene strategies and reducing screen time before bed.', type: 'Check-in', mood: 'Anxious', tags: ['sleep', 'parent-consultation', 'screen-time'], days: 30 },
    { pid: p1Id, content: 'Aarav disclosed that he was being teased by classmates. This appears to be a significant trigger for his anxiety. Discussed coping strategies and will liaise with school counsellor. Risk score has increased — monitoring closely.', type: 'Session', mood: 'Anxious', tags: ['bullying', 'school', 'risk-increase'], days: 7 },

    // Priya Nair
    { pid: p2Id, content: 'Initial assessment. Priya presents with low mood, anhedonia and reduced appetite over the past 2 months following parental separation. PHQ-A score elevated. Started on CBT protocol for adolescent depression.', type: 'Session', mood: 'Depressed', tags: ['CBT', 'family-situation', 'PHQ-A'], days: 150 },
    { pid: p2Id, content: 'Session 3. Priya engaged well with behavioural activation exercise. Completed mood diary — notes she feels slightly better on days she goes for a walk. Introduced thought records.', type: 'Session', mood: 'Neutral', tags: ['behavioural-activation', 'mood-diary', 'thought-records'], days: 90 },
    { pid: p2Id, content: 'Crisis check-in. Priya sent a message to her mother saying she did not want to be here anymore. Conducted safety assessment — no active plan, protective factors include younger sister. Safety plan created. Parents informed. Increased session frequency to weekly.', type: 'Crisis', mood: 'Depressed', tags: ['safety-assessment', 'crisis', 'safety-plan'], days: 40 },
    { pid: p2Id, content: 'Family meeting with father and mother (attending separately). Both parents committed to ensuring Priya has consistent contact with both. Psychoeducation provided to both parents about adolescent depression.', type: 'Family Meeting', mood: 'Neutral', tags: ['family-meeting', 'psychoeducation', 'parental-involvement'], days: 20 },
    { pid: p2Id, content: 'Risk score continues to rise. Considering referral to psychiatrist for medication evaluation alongside ongoing CBT. Will discuss with Priya and family at next session.', type: 'Session', mood: 'Depressed', tags: ['medication-review', 'referral', 'high-risk'], days: 5 },

    // Rohan Desai
    { pid: p3Id, content: 'Initial assessment. Rohan referred by school for ADHD assessment. Presents with significant hyperactivity, impulsivity, and recent onset anxiety. Formal ADHD assessment initiated. Spoke with teacher.', type: 'Session', mood: 'Agitated', tags: ['ADHD', 'assessment', 'school-referral'], days: 120 },
    { pid: p3Id, content: 'ADHD assessment completed. Confirmed ADHD Combined Type with comorbid anxiety. Discussed diagnosis with family. Referred to paediatrician for medication evaluation. Started anxiety management alongside.', type: 'Session', mood: 'Neutral', tags: ['ADHD', 'diagnosis', 'medication-referral'], days: 90 },
    { pid: p3Id, content: 'Good progress noted. Rohan started on methylphenidate 2 weeks ago — mother reports significant improvement in focus. Anxiety also reducing. Continuing CBT for anxiety component.', type: 'Progress', mood: 'Positive', tags: ['medication', 'progress', 'CBT'], days: 45 },
    { pid: p3Id, content: 'Excellent session. Rohan brought his school report — grades have improved. He is proud of himself. Discussed maintaining strategies and relapse prevention.', type: 'Session', mood: 'Positive', tags: ['progress', 'school-improvement', 'relapse-prevention'], days: 3 },

    // Ananya Krishnan
    { pid: p4Id, content: 'Initial assessment. Ananya presents with severe separation anxiety — cannot stay at school without parent present. Has been home-schooled for 3 months. Detailed family history taken.', type: 'Session', mood: 'Anxious', tags: ['separation-anxiety', 'school-refusal', 'family-history'], days: 120 },
    { pid: p4Id, content: 'Session 4. Graduated exposure programme started. Step 1: parent waits outside school gate. Ananya managed 2 hours alone today — significant achievement. Lots of positive reinforcement.', type: 'Session', mood: 'Anxious', tags: ['exposure-therapy', 'graduated-exposure', 'progress'], days: 75 },
    { pid: p4Id, content: 'Great progress. Ananya back in school full time this week. Some anxiety but managing with coping cards. Mother very pleased. Reducing session frequency to fortnightly.', type: 'Progress', mood: 'Positive', tags: ['school-return', 'progress', 'coping-strategies'], days: 30 },
    { pid: p4Id, content: 'Review session. Ananya doing well. Attended a birthday party independently last weekend — a huge milestone. Discussing discharge planning over next 2 sessions.', type: 'Session', mood: 'Positive', tags: ['milestone', 'discharge-planning', 'positive'], days: 4 },

    // Dev Mehta
    { pid: p5Id, content: 'Initial assessment. Dev referred by school after selective mutism in class. Extremely limited verbal communication outside home. Comprehensive assessment — meets criteria for Social Anxiety Disorder. Severe presentation.', type: 'Session', mood: 'Anxious', tags: ['social-anxiety', 'selective-mutism', 'severe'], days: 120 },
    { pid: p5Id, content: 'Session 5. Dev making very slow progress. Finds it extremely difficult to engage verbally in sessions. Using written communication. Has not attended school for 3 weeks. Consulting with psychiatry.', type: 'Session', mood: 'Anxious', tags: ['school-refusal', 'psychiatry-consult', 'communication'], days: 75 },
    { pid: p5Id, content: 'Urgent review. Parents reported Dev said he felt no one would miss him. Safety assessment conducted — no active ideation or plan. Safety plan updated. Increased to twice-weekly sessions. Psychiatry appointment expedited.', type: 'Crisis', mood: 'Depressed', tags: ['crisis', 'safety-plan', 'urgent'], days: 35 },
    { pid: p5Id, content: 'Family meeting. Parents very distressed. Educated on crisis warning signs. Father will work from home until next assessment. Crisis line numbers given to family. Liaising with school for home tuition.', type: 'Family Meeting', mood: 'Neutral', tags: ['family-support', 'crisis-management', 'school-liaison'], days: 20 },
    { pid: p5Id, content: 'Risk score at 82 — Severe. ADMRI alert triggered. Coordinating with psychiatry for urgent assessment. Parents aware. Home visit arranged for next week. All crisis contacts active.', type: 'Crisis', mood: 'Depressed', tags: ['severe-risk', 'psychiatry-urgent', 'crisis-coordination'], days: 2 },
  ];

  for (const n of notes) {
    const date = new Date();
    date.setDate(date.getDate() - n.days);
    await pool.query(`
      INSERT INTO notes (id, patient_id, doctor_id, content, type, mood, tags, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO NOTHING
    `, [
      uuidv4(), n.pid, PRIYA,
      n.content, n.type, n.mood,
      JSON.stringify(n.tags),
      date.toISOString(),
    ]);
  }

  console.log('✅ Notes created (21 clinical notes across 5 patients)\n');

  // ── ALSO seed 2 patients for Arjun ───────────────────────────────────────────
  const p6Id = uuidv4();
  const p7Id = uuidv4();

  await pool.query(`
    INSERT INTO patients (id, doctor_id, name, age, gender, diagnosis, guardian, contact,
                          latest_score, risk_level, risk_history, join_date)
    VALUES
      ($1, $2, 'Kabir Singh',    11, 'Male',   'Selective Mutism',
       'Harpreet Singh', '9871234560', 45, 'Moderate', '{60,55,50,45}', '2024-09-10'),
      ($3, $2, 'Zara Khan',      16, 'Female', 'Panic Disorder',
       'Imran Khan',     '9812345670', 52, 'Moderate', '{70,65,58,52}', '2024-08-05')
    ON CONFLICT (id) DO NOTHING
  `, [p6Id, ARJUN, p7Id]);

  await pool.query(`
    INSERT INTO notes (id, patient_id, doctor_id, content, type, mood, tags, created_at)
    VALUES
      ($1, $2, $3, 'Kabir presenting with selective mutism at school. Speaks normally at home. Starting gradual exposure programme.', 'Session', 'Anxious', '["selective-mutism","exposure"]', NOW() - INTERVAL '20 days'),
      ($4, $5, $3, 'Zara had a severe panic attack at school last week. Psychoeducation on panic cycle provided. Starting interoceptive exposure.', 'Session', 'Anxious', '["panic-disorder","CBT","psychoeducation"]', NOW() - INTERVAL '14 days')
    ON CONFLICT (id) DO NOTHING
  `, [uuidv4(), p6Id, ARJUN, uuidv4(), p7Id]);

  console.log('✅ Arjun patients created (2 patients)\n');

  console.log('═══════════════════════════════════════════');
  console.log('  All demo data seeded successfully!');
  console.log('═══════════════════════════════════════════');
  console.log('  Login: priya@admri.in  / doctor123');
  console.log('  Login: arjun@admri.in  / doctor456');
  console.log('═══════════════════════════════════════════\n');

  await pool.end();
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
