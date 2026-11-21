/* The 17 Sustainable Development Goals, with the UN's colour for each.
   Used by External Research (the "SDGs hit" checkboxes and the chips). */
export const SDGS = [
  [1,  'No Poverty',                               '#e5243b'],
  [2,  'Zero Hunger',                              '#dda63a'],
  [3,  'Good Health and Well-being',               '#4c9f38'],
  [4,  'Quality Education',                        '#c5192d'],
  [5,  'Gender Equality',                          '#ff3a21'],
  [6,  'Clean Water and Sanitation',               '#26bde2'],
  [7,  'Affordable and Clean Energy',              '#fcc30b'],
  [8,  'Decent Work and Economic Growth',          '#a21942'],
  [9,  'Industry, Innovation, and Infrastructure', '#fd6925'],
  [10, 'Reduced Inequalities',                     '#dd1367'],
  [11, 'Sustainable Cities and Communities',       '#fd9d24'],
  [12, 'Responsible Consumption and Production',   '#bf8b2e'],
  [13, 'Climate Action',                           '#3f7e44'],
  [14, 'Life below Water',                         '#0a97d9'],
  [15, 'Life on Land',                             '#56c02b'],
  [16, 'Peace, Justice, and Strong Institutions',  '#00689d'],
  [17, 'Partnership for the Goals',                '#19486a'],
];
export const sdgName = (n) => { const s = SDGS.find((x) => x[0] === Number(n)); return s ? `SDG ${s[0]}: ${s[1]}` : `SDG ${n}`; };
export const sdgList = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map(Number).filter((n) => n >= 1 && n <= 17).sort((a, b) => a - b);