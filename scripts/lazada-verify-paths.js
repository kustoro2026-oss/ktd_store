// Verify all English category paths exist in the template_hide dropdown (lazada-file1.xlsx)
const XLSX = require('xlsx');

const tWb = XLSX.readFile('tiktok-upload/lazada-file1.xlsx');
const h = XLSX.utils.sheet_to_json(tWb.Sheets['template_hide'], { header: 1, defval: '', raw: true });
const dd = new Set();
for (let i = 6; i < h.length; i++) {
  const v = String(h[i][2] || '').trim();
  if (v) dd.add(v);
}

const PATHS = {
  '10003382': 'Household Supplies,Cleaning Agents,Bathroom & Toilet,Toilet Cleaners',
  '18399': 'Household Supplies,Cleaning Agents,Multipurpose Cleaner',
  '18394': 'Household Supplies,Cleaning Agents,Sinks & Drains',
  '18392': 'Household Supplies,Cleaning Agents,Bleach & Disinfectants',
  '10003387': 'Household Supplies,Cleaning Agents,Floors & Carpets,Floor Cleaners',
  '18376': 'Household Supplies,Laundry Supplies,Washing Machine Cleaner',
  '62514802': 'Household Supplies,Laundry Supplies,Laundry Capsules, Pods & Sheets',
  '18371': 'Household Supplies,Laundry Supplies,Liquid Detergent',
  '18377': 'Household Supplies,Laundry Supplies,Powder Detergent',
  '16156': 'Pet Supplies,Pet Accessories,Litter & Housebreaking,Odor & Strain Removers',
  '17096': 'Automotive,Cars,Car Care Equipment,Interior Vehicle Care,Floors & Upholstery Care',
  '16561': 'Tools & Home Improvement,Floors, Walls and Ceiling,Adhesives, Mix, & Sealants',
  '18378': 'Household Supplies,Pest Control,Insect Baits & Traps',
  '18381': 'Household Supplies,Pest Control,Insecticide Sprays, Devices & Coils',
  '16649': 'Outdoor & Garden,Gardening,Garden Soil & Fertilizers',
  '16653': 'Outdoor & Garden,Gardening,Plants, Seeds, & Bulbs',
  '16654': 'Outdoor & Garden,Gardening,Weeds & Pest Control',
  '18202': 'Health,Food Supplement,Well Being,Herbs & Traditional Medicine',
  '18077': 'Health,Medical Supplies,Over The Counter Medicine,Topical Analgesics',
  '18194': 'Beauty,Personal Care,Bath & Body,Foot Care,Foot Masks',
  '18203': 'Health,Food Supplement,Well Being,Nutritional Foods & Drinks',
  '62549203': 'Health,Medical Supplies,Over The Counter Medicine,Anti-Itch',
  '62470802': 'Health,Medical Supplies,Over The Counter Medicine,Other Over The Counter Medicines',
  '18201': 'Health,Food Supplement,Weight Management,Slimming',
  '10100737': 'Beauty,Skin Care,Facial Moisturizers',
  '10003015': 'Beauty,Personal Care,Bath & Body,Body Enhancers & Treatments',
  '6332': 'Health,Food Supplement,Beauty Supplements,Anti-Aging',
  '3628': 'Beauty,Personal Care,Bath & Body,Body Moisturizers',
  '10003070': 'Beauty,Personal Care,Bath & Body,Bar Soap',
  '5404': 'Beauty,Personal Care,Feminine Care,Vaginal Cream',
  '3739': 'Beauty,Personal Care,Deodorants',
  '18060': 'Beauty,Fragrances,Women',
  '18062': 'Beauty,Fragrances,Unisex',
  '15636': 'Sports & Outdoors Activities Equipment,Outdoor Sports & Activities Equipment,Fishing,Lures & Baits',
  '62114404': 'Pet Supplies,Pet Healthcare,Supplements & Vitamins,Vitamins & Minerals',
  '16081': 'Pet Supplies,Pet Food,Cat Food & Treat,Cat Treats',
  '17965': "Men's Clothing,Heritage & Cultural Wear,Muslim Wear,Muslimin Shirts",
  '10003461': 'Groceries,Fruit & Vegetables,Fresh Fruit,Tropical Fruit,Dates, Figs & Persimmons',
};

let ok = 0, fail = 0;
for (const [id, p] of Object.entries(PATHS)) {
  if (dd.has(p)) { ok++; console.log('OK  ', id, p); }
  else {
    fail++;
    console.log('FAIL', id, p);
    // find closest matches
    const parts = p.split(',');
    const prefix = parts.slice(0, 3).join(',');
    console.log('     candidates:', [...dd].filter(d => d.startsWith(prefix)).slice(0, 6).join(' || '));
  }
}
console.log('\nResult:', ok, 'ok,', fail, 'fail. Total dropdown entries:', dd.size);
