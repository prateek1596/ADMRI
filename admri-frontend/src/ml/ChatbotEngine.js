import * as tf from '@tensorflow/tfjs';

/* ===============================
   1. INTENTS
================================ */

export const INTENTS = {
  CRISIS: 0,
  MOOD_LOW: 1,
  ANXIETY: 2,
  SLEEP: 3,
  COPING_REQUEST: 4,
  PROGRESS: 5,
  GENERAL: 6,
  INFO_REQUEST: 7,
};

const INTENT_LABELS = [
  'crisis',
  'mood_low',
  'anxiety',
  'sleep',
  'coping_request',
  'progress',
  'general',
  'info_request'
];


/* ===============================
   2. VOCAB + TOKENIZER
================================ */

const VOCAB = [
  '<PAD>', '<UNK>',
  'suicide','kill','die','death','hurt','harm','cut','overdose',
  'hopeless','worthless','empty','sad','cry','depressed',
  'anxiety','anxious','panic','worry','scared','stress',
  'sleep','insomnia','nightmare','tired',
  'help','cope','better','relax','breathe','ground',
  'good','happy','hopeful','progress',
  'what','how','why','explain','therapy','doctor','cbt',
  'i','me','my','feel','today','sometimes','always','never',
  'can','cannot','not','no','yes','want','need','like','think'
];

const WORD_INDEX = Object.fromEntries(VOCAB.map((w, i) => [w, i]));
const VOCAB_SIZE = VOCAB.length;
const SEQ_LEN = 20;

function tokenize(text) {

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, SEQ_LEN);

  const ids = words.map(w => WORD_INDEX[w] ?? 1);

  while (ids.length < SEQ_LEN) ids.push(0);

  return ids;
}


/* ===============================
   3. CRISIS DETECTION
================================ */

const CRISIS_KEYWORDS = [
  "suicide",
  "kill myself",
  "end my life",
  "want to die",
  "better off dead",
  "hurt myself"
];

function detectCrisis(text) {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some(k => lower.includes(k));
}

/* Ambiguous distress */

function detectAmbiguousDistress(text){

  const patterns = [
    "life feels pointless",
    "nothing matters anymore",
    "i want to disappear",
    "i can't keep going",
    "wish i wasn't here"
  ];

  const lower = text.toLowerCase();
  return patterns.some(p => lower.includes(p));
}


/* ===============================
   4. MODEL
================================ */

function buildIntentModel(){

  const model = tf.sequential();

  model.add(tf.layers.embedding({
    inputDim: VOCAB_SIZE,
    outputDim: 16,
    inputLength: SEQ_LEN,
    maskZero:true
  }));

  model.add(tf.layers.globalAveragePooling1d());

  model.add(tf.layers.dense({
    units:32,
    activation:'relu'
  }));

  model.add(tf.layers.dropout({rate:0.3}));

  model.add(tf.layers.dense({
    units:Object.keys(INTENTS).length,
    activation:'softmax'
  }));

  model.compile({
    optimizer: tf.train.adam(0.005),
    loss: 'sparseCategoricalCrossentropy',
    metrics: ['accuracy']
  });

  return model;
}


/* ===============================
   5. TRAINING DATA
================================ */

const TRAINING_CORPUS = [
  {text:"I want to kill myself",label:0},
  {text:"I feel worthless",label:1},
  {text:"I feel anxious today",label:2},
  {text:"I can't sleep at night",label:3},
  {text:"how can I feel better",label:4},
  {text:"I feel much better today",label:5},
  {text:"hello",label:6},
  {text:"what is CBT",label:7},
];


/* ===============================
   6. RESPONSES
================================ */

const RESPONSES = {

crisis:[
{
text:"I'm really glad you reached out. What you're feeling matters. Please contact a crisis helpline immediately — iCall: 9152987821.",
followUp:"Are you safe right now?"
}
],

mood_low:[
{
text:"It sounds like things have been heavy lately. Small steps can help shift mood over time.",
followUp:"What has been hardest today?",
cbt:"Behavioral Activation: try one small activity like a short walk."
}
],

anxiety:[
{
text:"Anxiety can feel overwhelming. Let's slow things down with a breathing exercise.",
followUp:"What usually triggers your anxiety?",
cbt:"Box breathing: inhale 4s, hold 4s, exhale 4s."
}
],

sleep:[
{
text:"Sleep issues can worsen mood. A consistent wake-up time often helps.",
followUp:"How many hours of sleep are you getting?"
}
],

coping_request:[
{
text:"It's great you're looking for coping strategies.",
followUp:"Would you like a grounding technique?",
cbt:"5-4-3-2-1 grounding technique."
}
],

progress:[
{
text:"That's wonderful to hear. Recognizing progress is important.",
followUp:"What helped you most?"
}
],

general:[
{
text:"Hi. I'm here to support you. How are you feeling today?"
}
]

};


/* ===============================
   7. RISK MODIFIER
================================ */

function getRiskModifier(score){

if(!score) return "";

if(score >=75)
return "Given your elevated risk score, I want to make sure we take extra care. ";

if(score >=50)
return "I'm mindful things have been difficult lately. ";

return "";
}


/* ===============================
   8. CONTEXT MEMORY
================================ */

export class ConversationContext{

constructor(){
this.turns=[];
this.maxTurns=5;
this.lastIntent=null;
this.escalationCount=0;
}

add(userText,botResponse,intent){

this.turns.push({userText,botResponse,intent});

if(this.turns.length>this.maxTurns)
this.turns.shift();

this.lastIntent=intent;

if([INTENTS.CRISIS,INTENTS.MOOD_LOW].includes(intent))
this.escalationCount++;
else
this.escalationCount=0;
}

isPersistentDistress(){
return this.escalationCount>=2;
}

getRecentIntentBias(){

if(this.turns.length===0)
return null;

const last=this.turns[this.turns.length-1].intent;

const count=this.turns.filter(t=>t.intent===last).length;

if(count>=2)
return last;

return null;
}

}


/* ===============================
   9. CHATBOT ENGINE
================================ */

export class ChatbotEngine{

constructor(){
this.model=null;
this.trained=false;
}

async train(){

this.model=buildIntentModel();

const xs=tf.tensor2d(
TRAINING_CORPUS.map(d=>tokenize(d.text)),
[TRAINING_CORPUS.length,SEQ_LEN],
'int32'
);

const ys=tf.tensor1d(
TRAINING_CORPUS.map(d=>d.label),
'int32'
);

await this.model.fit(xs,ys,{
epochs:30,
batchSize:16
});

xs.dispose();
ys.dispose();

this.trained=true;
}


/* ===============================
   INTENT CLASSIFICATION
================================ */

async classifyIntent(text){

if(!this.model)
return {intent:INTENTS.GENERAL,confidence:1};

const ids=tokenize(text);

const tensor=tf.tensor2d([ids],[1,SEQ_LEN],'int32');

const probs=this.model.predict(tensor);

const arr=await probs.data();

tensor.dispose();
probs.dispose();

const maxIdx=arr.indexOf(Math.max(...arr));

return{
intent:maxIdx,
confidence:arr[maxIdx]
};

}


/* ===============================
   RESPONSE ENGINE
================================ */

async respond(userText,context,admriScore=null){

if(!userText?.trim()){
return{
text:"I'm here. Take your time.",
intent:'general'
};
}

/* Crisis detection */

if(detectCrisis(userText)||detectAmbiguousDistress(userText)){

const template=RESPONSES.crisis[0];

const response={
text:template.text,
followUp:template.followUp,
intent:'crisis',
isCrisis:true
};

context.add(userText,response.text,INTENTS.CRISIS);

return response;
}

/* Intent classification */

let intent=INTENTS.GENERAL;
let confidence=1;

if(this.trained){

const result=await this.classifyIntent(userText);

intent=result.intent;
confidence=result.confidence;

if(confidence<0.35)
intent=INTENTS.GENERAL;
}

/* Intent smoothing */

const bias=context.getRecentIntentBias();

if(bias!==null && confidence<0.55)
intent=bias;

const intentName=INTENT_LABELS[intent];

const templates=RESPONSES[intentName] ?? RESPONSES.general;

const template=templates[0];

const riskPrefix=getRiskModifier(admriScore);

let text=riskPrefix+(template.text||"");

if(context.isPersistentDistress() && intent!==INTENTS.CRISIS){

text+=`

I've noticed you've been feeling this way across our last few conversations. It might help to discuss this with your doctor or therapist soon.`;
}

const response={
text,
cbt:template.cbt||null,
followUp:template.followUp||null,
intent:intentName,
confidence:Math.round(confidence*100),
isCrisis:false
};

context.add(userText,response.text,intent);

return response;
}

}