// Seviye belirleme testi: her seviyeden 4 soru, kolaydan zora. [soru, seçenekler, doğru indeks]
export const PLACEMENT = [
  { level: 'A1', q: 'She ___ a doctor.', options: ['am', 'is', 'are'], answer: 1 },
  { level: 'A1', q: '"Kitap" İngilizcede hangisi?', options: ['book', 'look', 'cook'], answer: 0 },
  { level: 'A1', q: 'I ___ two brothers.', options: ['has', 'have', 'am'], answer: 1 },
  { level: 'A1', q: 'Where ___ you from?', options: ['is', 'do', 'are'], answer: 2 },
  { level: 'A2', q: 'We ___ to the cinema last night.', options: ['go', 'went', 'gone'], answer: 1 },
  { level: 'A2', q: 'This bag is ___ than that one.', options: ['cheaper', 'more cheap', 'cheapest'], answer: 0 },
  { level: 'A2', q: 'Look at those clouds! It ___ rain.', options: ['is going to', 'goes to', 'will to'], answer: 0 },
  { level: 'A2', q: 'You ___ see a doctor. You look ill.', options: ['should', 'should to', 'are should'], answer: 0 },
  { level: 'B1', q: 'I ___ here since 2019.', options: ['live', 'have lived', 'am living'], answer: 1 },
  { level: 'B1', q: 'If it rains tomorrow, we ___ at home.', options: ['stay', 'would stay', 'will stay'], answer: 2 },
  { level: 'B1', q: 'The bridge ___ in 1973.', options: ['built', 'was built', 'has built'], answer: 1 },
  { level: 'B1', q: 'I ___ play football when I was a child.', options: ['used to', 'use to', 'was used to'], answer: 0 },
  { level: 'B2', q: 'If I ___ the answer, I would have told you.', options: ['knew', 'had known', 'have known'], answer: 1 },
  { level: 'B2', q: 'She suggested ___ a taxi.', options: ['to take', 'taking', 'take'], answer: 1 },
  { level: 'B2', q: 'By next year, they ___ the new hospital.', options: ['will have finished', 'will finish', 'have finished'], answer: 0 },
  { level: 'B2', q: 'He must ___ forgotten the meeting.', options: ['be', 'have', 'had'], answer: 1 },
  { level: 'C1', q: 'Not only ___ late, but he also forgot the documents.', options: ['he was', 'was he', 'he did'], answer: 1 },
  { level: 'C1', q: 'It\'s high time we ___ a decision.', options: ['make', 'made', 'will make'], answer: 1 },
  { level: 'C1', q: 'Hardly ___ the house when it started to rain.', options: ['I had left', 'had I left', 'I left'], answer: 1 },
  { level: 'C1', q: 'The proposal was met with ___ criticism.', options: ['widespread', 'widely', 'wide-spreading'], answer: 0 },
];

// Bir seviye, kendisi ve önceki seviyelerin her birinde en az 3/4 doğru yapılırsa geçilmiş sayılır.
export function placementResult(answers) {
  const order = ['A1', 'A2', 'B1', 'B2', 'C1'];
  const byLevel = Object.fromEntries(order.map((l) => [l, 0]));
  PLACEMENT.forEach((q, i) => { if (answers[i] === q.answer) byLevel[q.level]++; });
  let reached = null;
  for (const l of order) { if (byLevel[l] >= 3) reached = l; else break; }
  const idx = reached ? order.indexOf(reached) : -1;
  const recommended = order[Math.min(idx + 1, order.length - 1)];
  return { byLevel, mastered: reached, recommended };
}
