/**
 * PairUpToday Gender Normalization & Resolution Utility
 * 
 * Accurately determines and normalizes gender ('MALE' | 'FEMALE') based on:
 * 1. Explicit metadata string (e.g. 'female', 'male', 'F', 'M')
 * 2. Strict distinction (preventing false positive 'female'.includes('mal'))
 * 3. Robust name heuristics for Indian & international names when gender is unprovided
 */

// Popular Indian & International female first names
const FEMALE_NAMES = new Set([
  'priti', 'preeti', 'anusha', 'priya', 'sneha', 'pooja', 'puja', 'neha', 'riya', 'swati', 
  'kavita', 'sunita', 'anjali', 'deepa', 'divya', 'suman', 'meera', 'rekha', 'rani', 'mita', 
  'rita', 'gita', 'geeta', 'shreya', 'ishita', 'tanvi', 'aditi', 'simran', 'muskan', 'khushi', 
  'ayesha', 'fatima', 'zoya', 'monika', 'sonali', 'payal', 'kajal', 'rupa', 'mousumi', 'debolina', 
  'soma', 'nandini', 'koyel', 'koel', 'sayani', 'madhuri', 'bishakha', 'tumpa', 'jhuma', 'piu', 
  'bristi', 'titli', 'doyel', 'raktima', 'sudipta', 'koushani', 'subhashree', 'mimi', 'nusrat', 
  'srabanti', 'rituparna', 'arpita', 'debasree', 'moumita', 'bipasha', 'pampa', 'rinku', 'pinky', 
  'sohini', 'sampa', 'kankana', 'poulomi', 'maitrayee', 'ranjita', 'alaka', 'sharmila', 'aparna', 
  'moonmoon', 'raima', 'mamata', 'mahua', 'mala', 'champa', 'chandana', 'shampa', 'chaitali', 
  'kakali', 'baisakhi', 'barnali', 'shilpa', 'archana', 'bandana', 'alpana', 'sutapa', 'sayantika',
  'megha', 'ishika', 'nithya', 'tanusree', 'ananya', 'trisha', 'pallavi', 'rashmi', 'jyoti', 'arti',
  'radha', 'shanti', 'lakshmi', 'sarita', 'rekha', 'geeta', 'asha', 'usha', 'tanya', 'mona'
]);

// Popular Indian & International male first names
const MALE_NAMES = new Set([
  'rahul', 'arjun', 'ritwik', 'arnab', 'rohit', 'amit', 'raj', 'rajesh', 'suresh', 'ramesh',
  'vikram', 'abhishek', 'deepak', 'sanjay', 'manoj', 'vijay', 'ajay', 'anil', 'sunil', 'alok',
  'ankit', 'ashish', 'vivek', 'gaurav', 'sachin', 'rohan', 'karan', 'varun', 'sid', 'siddharth',
  'sourabh', 'sourav', 'subham', 'shubham', 'debashis', 'debasish', 'anirban', 'subrata',
  'indranil', 'sayak', 'tamal', 'pritam', 'arup', 'swarup', 'sujay', 'sanjoy', 'prasenjit',
  'mohit', 'tarun', 'harsh', 'kunal', 'nikhil', 'pankaj', 'suraj', 'dinesh', 'mukesh', 'dev'
]);

export function normalizeGender(rawGender?: string | null, name?: string | null): 'MALE' | 'FEMALE' {
  if (rawGender) {
    const g = String(rawGender).trim().toLowerCase();
    
    // 1. Strictly check female first to prevent 'female'.includes('mal') false positive!
    if (
      g === 'female' ||
      g === 'f' ||
      g.startsWith('fem') ||
      g.includes('woman') ||
      g.includes('women') ||
      g.includes('girl') ||
      g.includes('she') ||
      g.includes('her') ||
      g === 'ms' ||
      g === 'mrs' ||
      g === 'miss'
    ) {
      return 'FEMALE';
    }

    // 2. Strictly check male
    if (
      g === 'male' ||
      g === 'm' ||
      g.startsWith('mal') ||
      g.includes('man') ||
      g.includes('boy') ||
      g.includes('he') ||
      g.includes('him') ||
      g === 'mr' ||
      g === 'mister'
    ) {
      return 'MALE';
    }
  }

  // 3. Name-based inference if rawGender is missing or blank
  if (name && typeof name === 'string') {
    const cleanName = name.replace(/^(mr\.|mrs\.|ms\.|miss|dr\.)\s+/i, '').trim();
    const firstName = cleanName.split(/\s+/)[0]?.toLowerCase() || '';

    if (FEMALE_NAMES.has(firstName)) {
      return 'FEMALE';
    }
    if (MALE_NAMES.has(firstName)) {
      return 'MALE';
    }

    // Common linguistic endings for feminine names in Indian languages
    if (
      firstName.endsWith('ti') ||
      firstName.endsWith('ya') ||
      firstName.endsWith('ka') ||
      firstName.endsWith('na') ||
      firstName.endsWith('ta') ||
      firstName.endsWith('ee') ||
      firstName.endsWith('shree') ||
      firstName.endsWith('i')
    ) {
      return 'FEMALE';
    }
  }

  // Default fallback
  return 'FEMALE';
}
