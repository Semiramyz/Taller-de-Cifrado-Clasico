export const ALPHABET = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';

export type DetectionMethod = 'César' | 'Afín' | 'Vigenère' | 'Desconocido';

export type AnalysisResult = {
  ic: number;
  diagnosis: string;
  key: number | string;
  plaintext: string;
  method: DetectionMethod;
};

const SPANISH_FREQUENCIES: Record<string, number> = {
  A: 12.53,
  B: 1.42,
  C: 4.3,
  D: 4.95,
  E: 13.68,
  F: 0.43,
  G: 1.12,
  H: 1.28,
  I: 6.25,
  J: 0.48,
  K: 0.05,
  L: 4.98,
  M: 3.41,
  N: 6.88,
  Ñ: 0.31,
  O: 8.68,
  P: 2.93,
  Q: 0.69,
  R: 6.87,
  S: 7.98,
  T: 4.69,
  U: 4.63,
  V: 0.95,
  W: 0.01,
  X: 0.22,
  Y: 0.83,
  Z: 0.45,
};

const LETTER_TO_INDEX = new Map(ALPHABET.split('').map((letter, index) => [letter, index]));

export function normalizeText(input: string): string {
  const normalized = String(input ?? '')
    .toUpperCase()
    .replace(/[ÁÀÂÄ]/g, 'A')
    .replace(/[ÉÈÊË]/g, 'E')
    .replace(/[ÍÌÎÏ]/g, 'I')
    .replace(/[ÓÒÔÖ]/g, 'O')
    .replace(/[ÚÙÛÜ]/g, 'U')
    .replace(/Ñ/g, 'Ñ')
    .replace(/[^A-ZÑ]/g, '');

  return normalized;
}

export function frequencyMap(text: string): number[] {
  const counts = new Array(27).fill(0);
  for (const char of text) {
    const index = LETTER_TO_INDEX.get(char);
    if (index !== undefined) {
      counts[index] += 1;
    }
  }
  return counts;
}

export function calculateIndexOfCoincidence(text: string): number {
  const clean = normalizeText(text);
  if (clean.length < 2) {
    return 0;
  }

  const counts = frequencyMap(clean);
  const total = clean.length;
  let numerator = 0;

  for (const count of counts) {
    numerator += count * (count - 1);
  }

  return numerator / (total * (total - 1));
}

function scoreAgainstReference(text: string): number {
  const clean = normalizeText(text);
  if (!clean) {
    return Number.POSITIVE_INFINITY;
  }

  const counts = frequencyMap(clean);
  const total = clean.length;
  let score = 0;

  for (let i = 0; i < ALPHABET.length; i += 1) {
    const observed = counts[i] / total;
    const expected = SPANISH_FREQUENCIES[ALPHABET[i]] / 100;
    score += Math.abs(observed - expected);
  }

  return score;
}

function modInverse(value: number, modulus: number): number {
  for (let candidate = 1; candidate < modulus; candidate += 1) {
    if ((value * candidate) % modulus === 1) {
      return candidate;
    }
  }

  return 0;
}

function toLetterIndex(letter: string): number {
  const normalized = normalizeText(letter);
  if (!normalized) {
    return -1;
  }
  return LETTER_TO_INDEX.get(normalized[0]) ?? -1;
}

function decryptCaesar(ciphertext: string, shift: number): string {
  return Array.from(ciphertext)
    .map((char) => {
      const idx = toLetterIndex(char);
      if (idx === -1) {
        return char;
      }
      return ALPHABET[(idx - shift + ALPHABET.length) % ALPHABET.length];
    })
    .join('');
}

function encryptCaesar(plaintext: string, shift: number): string {
  return Array.from(plaintext)
    .map((char) => {
      const idx = toLetterIndex(char);
      if (idx === -1) {
        return char;
      }
      return ALPHABET[(idx + shift + ALPHABET.length) % ALPHABET.length];
    })
    .join('');
}

function decryptAffine(ciphertext: string, a: number, b: number): string {
  const inverseA = modInverse(a, ALPHABET.length);
  if (inverseA === 0) {
    return ciphertext;
  }

  return Array.from(ciphertext)
    .map((char) => {
      const idx = toLetterIndex(char);
      if (idx === -1) {
        return char;
      }
      const decoded = ((inverseA * ((idx - b + ALPHABET.length) % ALPHABET.length)) + ALPHABET.length) % ALPHABET.length;
      return ALPHABET[decoded];
    })
    .join('');
}

export function encryptAffine(plaintext: string, a: number, b: number): string {
  return Array.from(plaintext)
    .map((char) => {
      const idx = toLetterIndex(char);
      if (idx === -1) {
        return char;
      }
      return ALPHABET[(a * idx + b) % ALPHABET.length];
    })
    .join('');
}

function estimateCaesarShift(ciphertext: string): { shift: number; plaintext: string; score: number } {
  let best = { shift: 0, plaintext: ciphertext, score: Number.POSITIVE_INFINITY };

  for (let shift = 0; shift < ALPHABET.length; shift += 1) {
    const plaintext = decryptCaesar(ciphertext, shift);
    const score = scoreAgainstReference(plaintext);
    if (score < best.score) {
      best = { shift, plaintext, score };
    }
  }

  return best;
}

function estimateAffineCoefficients(ciphertext: string): { a: number; b: number; plaintext: string; score: number } {
  let best = { a: 1, b: 0, plaintext: ciphertext, score: Number.POSITIVE_INFINITY };

  for (let a = 1; a < ALPHABET.length; a += 1) {
    if (gcd(a, ALPHABET.length) !== 1) {
      continue;
    }

    for (let b = 0; b < ALPHABET.length; b += 1) {
      const plaintext = decryptAffine(ciphertext, a, b);
      const score = scoreAgainstReference(plaintext);
      if (score < best.score) {
        best = { a, b, plaintext, score };
      }
    }
  }

  return best;
}

function gcd(first: number, second: number): number {
  let a = Math.abs(first);
  let b = Math.abs(second);

  while (b !== 0) {
    const temp = a % b;
    a = b;
    b = temp;
  }

  return a;
}

function calculateColumnIndexOfCoincidence(column: string): number {
  const counts = frequencyMap(column);
  const total = column.length;
  if (total < 2) {
    return 0;
  }

  let numerator = 0;
  for (const count of counts) {
    numerator += count * (count - 1);
  }

  return numerator / (total * (total - 1));
}

function estimateKeyLengthKasiski(ciphertext: string, maxLength = 16): number {
  const text = normalizeText(ciphertext);
  const candidates = new Map<number, number>();

  for (let length = 3; length <= Math.min(6, text.length - 1); length += 1) {
    const seen = new Map<string, number[]>();
    for (let index = 0; index <= text.length - length; index += 1) {
      const slice = text.slice(index, index + length);
      if (!seen.has(slice)) {
        seen.set(slice, []);
      }
      seen.get(slice)!.push(index);
    }

    for (const positions of seen.values()) {
      if (positions.length < 2) {
        continue;
      }

      for (let i = 1; i < positions.length; i += 1) {
        const gap = Math.abs(positions[i] - positions[i - 1]);
        if (gap > 0) {
          const candidate = gcd(gap, text.length);
          if (candidate > 1 && candidate <= maxLength) {
            candidates.set(candidate, (candidates.get(candidate) ?? 0) + 1);
          }
        }
      }
    }
  }

  if (candidates.size > 0) {
    const [bestLength] = [...candidates.entries()].sort((a, b) => b[1] - a[1])[0];
    return bestLength;
  }

  let bestLength = 3;
  let bestAverageIC = Number.NEGATIVE_INFINITY;
  for (let length = 1; length <= maxLength; length += 1) {
    const columns: string[] = Array.from({ length }, () => '');
    for (let index = 0; index < text.length; index += 1) {
      columns[index % length] += text[index];
    }
    const averageIC = columns.reduce((sum, column) => sum + calculateIndexOfCoincidence(column), 0) / columns.length;
    if (averageIC > bestAverageIC) {
      bestLength = length;
      bestAverageIC = averageIC;
    }
  }

  return bestLength;
}

function analyzeVigenere(ciphertext: string): { key: string; plaintext: string; score: number } {
  const normalized = normalizeText(ciphertext);
  if (!normalized) {
    return { key: '', plaintext: '', score: Number.POSITIVE_INFINITY };
  }

  let best = { key: '', plaintext: normalized, score: Number.POSITIVE_INFINITY };
  const maxKeyLength = Math.min(12, Math.max(1, normalized.length / 4));

  for (let keyLength = 1; keyLength <= maxKeyLength; keyLength += 1) {
    const columns: string[] = Array.from({ length: keyLength }, () => '');
    for (let index = 0; index < normalized.length; index += 1) {
      columns[index % keyLength] += normalized[index];
    }

    const keyIndexes: number[] = [];
    for (const column of columns) {
      const candidate = estimateCaesarShift(column);
      keyIndexes.push(candidate.shift % ALPHABET.length);
    }

    const key = keyIndexes.map((value) => ALPHABET[value]).join('');
    const plaintext = decryptVigenere(normalized, key);
    const score = scoreAgainstReference(plaintext);

    if (score < best.score) {
      best = { key, plaintext, score };
    }
  }

  return best;
}

export function decryptVigenere(ciphertext: string, key: string): string {
  const normalizedCiphertext = normalizeText(ciphertext);
  const normalizedKey = normalizeText(key);

  if (!normalizedKey) {
    return normalizedCiphertext;
  }

  let result = '';
  for (let index = 0; index < normalizedCiphertext.length; index += 1) {
    const textIndex = toLetterIndex(normalizedCiphertext[index]);
    const keyIndex = toLetterIndex(normalizedKey[index % normalizedKey.length]);
    if (textIndex === -1 || keyIndex === -1) {
      continue;
    }
    result += ALPHABET[(textIndex - keyIndex + ALPHABET.length) % ALPHABET.length];
  }

  return result;
}

export function encryptVigenere(plaintext: string, key: string): string {
  const normalizedPlaintext = normalizeText(plaintext);
  const normalizedKey = normalizeText(key);

  if (!normalizedKey) {
    return normalizedPlaintext;
  }

  let result = '';
  for (let index = 0; index < normalizedPlaintext.length; index += 1) {
    const textIndex = toLetterIndex(normalizedPlaintext[index]);
    const keyIndex = toLetterIndex(normalizedKey[index % normalizedKey.length]);
    if (textIndex === -1 || keyIndex === -1) {
      continue;
    }
    result += ALPHABET[(textIndex + keyIndex) % ALPHABET.length];
  }

  return result;
}

export function analyzeCiphertext(ciphertext: string): AnalysisResult {
  const normalized = normalizeText(ciphertext);
  if (!normalized) {
    return {
      ic: 0,
      diagnosis: 'Sin texto para analizar.',
      key: '',
      plaintext: '',
      method: 'Desconocido',
    };
  }

  const ic = calculateIndexOfCoincidence(normalized);
  const caesar = estimateCaesarShift(normalized);
  const affine = estimateAffineCoefficients(normalized);
  const vigenere = analyzeVigenere(normalized);

  const candidates = [
    { method: 'César' as DetectionMethod, score: caesar.score, key: caesar.shift, plaintext: caesar.plaintext },
    { method: 'Afín' as DetectionMethod, score: affine.score, key: `${affine.a},${affine.b}`, plaintext: affine.plaintext },
    { method: 'Vigenère' as DetectionMethod, score: vigenere.score, key: vigenere.key, plaintext: vigenere.plaintext },
  ];

  const best = candidates.reduce((current, candidate) => (candidate.score < current.score ? candidate : current));

  const diagnosisPrefix = best.method === 'Vigenère' ? 'Cifrado polialfabético detectado' : 'Cifrado monoalfabético detectado';
  const diagnosisText =
    best.method === 'Vigenère'
      ? `Cifrado polialfabético detectado: Vigenère. IC = ${ic.toFixed(4)} está dentro del rango esperado para español con clave repetida.`
      : `Cifrado monoalfabético detectado: ${best.method}. IC = ${ic.toFixed(4)} se acerca al valor del español.`;

  return {
    ic,
    diagnosis: diagnosisText,
    key: best.key,
    plaintext: best.plaintext,
    method: best.method,
  };
}

export { encryptCaesar, decryptCaesar, decryptAffine, estimateCaesarShift, estimateAffineCoefficients };
