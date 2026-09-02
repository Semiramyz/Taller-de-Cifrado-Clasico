import { describe, expect, it } from 'vitest';
import { analyzeCiphertext, normalizeText, encryptCaesar, encryptAffine, encryptVigenere } from './crypto';

const plaintext =
  'ESTEESUNMENSAJEDEPRUEBAENESPANOLPARAEVALUARLAESTADISTICADECOINCIDENCIADEESTECRIPTOGRAFACONMASDECUATROCIENTOSCARAETERES' +
  'ESTEESUNMENSAJEDEPRUEBAENESPANOLPARAEVALUARLAESTADISTICADECOINCIDENCIADEESTECRIPTOGRAFACONMASDECUATROCIENTOSCARAETERES' +
  'ESTEESUNMENSAJEDEPRUEBAENESPANOLPARAEVALUARLAESTADISTICADECOINCIDENCIADEESTECRIPTOGRAFACONMASDECUATROCIENTOSCARAETERES';

describe('crypto analysis', () => {
  it('normalizes Spanish text correctly', () => {
    expect(normalizeText('¡Hola, mundo! áéíóú ñ')).toBe('HOLAMUNDOAEIOUÑ');
  });

  it('detects and deciphers a Caesar cipher', () => {
    const cipher = encryptCaesar(plaintext, 7);
    const result = analyzeCiphertext(cipher);

    expect(result.diagnosis).toContain('César');
    expect(result.plaintext).toContain('ESTEESUNMENSAJE');
    expect(result.key).toBe(7);
  });

  it('detects and deciphers a Vigenere cipher', () => {
    const cipher = encryptVigenere(plaintext, 'CLAVE');
    const result = analyzeCiphertext(cipher);

    expect(result.diagnosis).toContain('Vigenère');
    expect(result.plaintext).toContain('ESTEESUNMENSAJE');
    expect(result.key).toBe('CLAVE');
  });

  it('detects and deciphers an affine cipher', () => {
    const cipher = encryptAffine(plaintext, 5, 3);
    const result = analyzeCiphertext(cipher);

    expect(result.diagnosis).toContain('Afín');
    expect(result.plaintext).toContain('ESTEESUNMENSAJE');
    expect(result.key).toBe('5,3');
  });
});
