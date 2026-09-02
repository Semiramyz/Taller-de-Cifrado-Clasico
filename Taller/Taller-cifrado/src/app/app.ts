import { Component, signal } from '@angular/core';
import {
  ALPHABET,
  analyzeCiphertext,
  decryptAffine,
  decryptCaesar,
  decryptVigenere,
  encryptAffine,
  encryptCaesar,
  encryptVigenere,
  frequencyMap,
  normalizeText,
} from './crypto';

type CaesarState = {
  plaintext: string;
  ciphertext: string;
  key: number;
};

type AffineState = {
  plaintext: string;
  ciphertext: string;
  a: number;
  b: number;
};

type VigenereState = {
  plaintext: string;
  ciphertext: string;
  key: string;
};

type FrequencyColumn = {
  letter: string;
  count: number;
  width: number;
};

@Component({
  selector: 'app-root',
  standalone: true,
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly caesarSample = normalizeText('Habla sobre la historia de la criptografía desde la antigüedad, mencionando que la necesidad de ocultar mensajes ha existido siempre para proteger secretos militares y políticos.');
  private readonly affineSample = normalizeText('Explica el análisis de frecuencias y cómo las letras como la E y la A son las más comunes en el idioma español, permitiendo romper cifrados monoalfabéticos con relativa facilidad.');
  private readonly vigenereSample = normalizeText('Describe la máquina Enigma y cómo Alan Turing logró descifrarla en Bletchley Park, cambiando el curso de la Segunda Guerra Mundial gracias al uso de las primeras computadoras electromecánicas.');

  private readonly caesarCipherSample = 'MFGPFXTGWJPFMNXYTWNFIJPFHWNUYTLWFKNFIJXIJPFFRYNLZJIFIQJRHNTRFRITVZJPFRJHJXNIFIIJTHZPYFWQJRXFÑJXMFJCNXYNITXNJQUWJUFWFUWTYJLJWXJHWJYTXQNPNYFWJXDUTPNYNHTX';
  private readonly affineCipherSample = 'ASGITQHAIHRHITUTUVAFPAQEARQTHUXQBNBIHUIAZPHUQBNBIHAXIHHUBRIHUNHUQBNERAUARAITVTBNHAUGHWBIGAPNTZTARVBPBNGAPQTFPHVBUNBRBHIFHMAZTQBUQBRPAIHZTJHFHQTITVHV';
  private readonly vigenereCipherSample = 'PYTGECCIXUNEDOJQNYÑMSGBCOJNSNFBQGOSMZAMSSMPHQNDMRMBVXUFQÑFFXOBMILKBVWWBPÑCBQPJFOOOSWBXFONNFKHHEESOFVEUNYZXJEXASEOCBWNFVWBXFONNQVUGFVNNDSYKVXNXPVNNFOQWUVBGFGNHJGNN';

  protected readonly caesarPresets = [
    { label: 'Reto 1: César - k = 11', value: 11 },
  ];

  protected readonly affinePresets = [
    { label: 'Reto 2: Afín - a = 5, b = 7', a: 5, b: 7 },
  ];

  protected readonly vigenerePresets = [
    { label: 'Reto 3: Vigenère - NUBE', value: 'NUBE' },
  ];

  protected readonly caesar = signal<CaesarState>({
    plaintext: '',
    ciphertext: '',
    key: 11,
  });

  protected readonly affine = signal<AffineState>({
    plaintext: '',
    ciphertext: '',
    a: 5,
    b: 7,
  });

  protected readonly vigenere = signal<VigenereState>({
    plaintext: '',
    ciphertext: '',
    key: 'NUBE',
  });

  protected readonly caesarAnalysisVisible = signal(false);
  protected readonly affineAnalysisVisible = signal(false);
  protected readonly vigenereAnalysisVisible = signal(false);

  protected readonly caesarAnalysis = signal(analyzeCiphertext(this.caesar().ciphertext));
  protected readonly affineAnalysis = signal(analyzeCiphertext(this.affine().ciphertext));
  protected readonly vigenereAnalysis = signal(analyzeCiphertext(this.vigenere().ciphertext));

  protected getCaesarChart(): FrequencyColumn[] {
    return this.buildFrequencyChart(this.caesar().ciphertext || this.caesar().plaintext);
  }

  protected getAffineChart(): FrequencyColumn[] {
    return this.buildFrequencyChart(this.affine().ciphertext || this.affine().plaintext);
  }

  protected getVigenereChart(): FrequencyColumn[] {
    return this.buildFrequencyChart(this.vigenere().ciphertext || this.vigenere().plaintext);
  }

  protected getCaesarChartMax(): number {
    return this.getChartMax(this.getCaesarChart());
  }

  protected getAffineChartMax(): number {
    return this.getChartMax(this.getAffineChart());
  }

  protected getVigenereChartMax(): number {
    return this.getChartMax(this.getVigenereChart());
  }

  protected getBarHeight(count: number, maxCount: number): number {
    const safeMax = Math.max(maxCount, 1);
    return 16 + (count / safeMax) * 150;
  }

  protected applyCaesarPreset(key: number): void {
    const safeKey = ((key % 27) + 27) % 27;
    const plaintext = normalizeText(this.caesar().plaintext || this.caesarSample);
    const ciphertext = encryptCaesar(plaintext, safeKey);

    this.caesar.set({ plaintext, ciphertext, key: safeKey });
    this.caesarAnalysisVisible.set(false);
    this.caesarAnalysis.set(analyzeCiphertext(ciphertext));
  }

  protected applyAffinePreset(a: number, b: number): void {
    const safeA = ((a % 27) + 27) % 27 || 1;
    const safeB = ((b % 27) + 27) % 27;
    const plaintext = normalizeText(this.affine().plaintext || this.affineSample);
    const ciphertext = encryptAffine(plaintext, safeA, safeB);

    this.affine.set({ plaintext, ciphertext, a: safeA, b: safeB });
    this.affineAnalysisVisible.set(false);
    this.affineAnalysis.set(analyzeCiphertext(ciphertext));
  }

  protected applyVigenerePreset(key: string): void {
    const safeKey = normalizeText(key || 'CLAVE');
    const plaintext = normalizeText(this.vigenere().plaintext || this.vigenereSample);
    const ciphertext = encryptVigenere(plaintext, safeKey);

    this.vigenere.set({ plaintext, ciphertext, key: safeKey });
    this.vigenereAnalysisVisible.set(false);
    this.vigenereAnalysis.set(analyzeCiphertext(ciphertext));
  }

  protected onCaesarPlaintextInput(event: Event): void {
    const nextValue = (event.target as HTMLTextAreaElement | null)?.value ?? '';
    this.caesar.set({ ...this.caesar(), plaintext: nextValue });
  }

  protected onCaesarCiphertextInput(event: Event): void {
    const nextValue = (event.target as HTMLTextAreaElement | null)?.value ?? '';
    this.caesar.set({ ...this.caesar(), ciphertext: nextValue });
  }

  protected onCaesarKeyInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement | null)?.value ?? '0');
    this.caesar.set({ ...this.caesar(), key: Number.isFinite(value) ? value : 0 });
  }

  protected encryptCaesarSection(): void {
    const nextKey = ((Number(this.caesar().key) % 27) + 27) % 27;
    const plaintext = normalizeText(this.caesar().plaintext);
    const ciphertext = encryptCaesar(plaintext, nextKey);

    this.caesar.set({ plaintext, ciphertext, key: nextKey });
    this.caesarAnalysisVisible.set(false);
    this.caesarAnalysis.set(analyzeCiphertext(ciphertext));
  }

  protected decryptCaesarSection(): void {
    const nextKey = ((Number(this.caesar().key) % 27) + 27) % 27;
    const ciphertext = normalizeText(this.caesar().ciphertext);
    const plaintext = decryptCaesar(ciphertext, nextKey);

    this.caesar.set({ plaintext, ciphertext, key: nextKey });
    this.caesarAnalysisVisible.set(false);
    this.caesarAnalysis.set(analyzeCiphertext(ciphertext));
  }

  protected analyzeCaesarSection(): void {
    const ciphertext = normalizeText(this.caesar().ciphertext || this.caesar().plaintext);
    this.caesarAnalysis.set(analyzeCiphertext(ciphertext));
    this.caesarAnalysisVisible.set(true);
  }

  protected clearCaesar(): void {
    this.caesar.set({ plaintext: '', ciphertext: '', key: 0 });
    this.caesarAnalysisVisible.set(false);
    this.caesarAnalysis.set(analyzeCiphertext(''));
  }

  protected onAffinePlaintextInput(event: Event): void {
    const nextValue = (event.target as HTMLTextAreaElement | null)?.value ?? '';
    this.affine.set({ ...this.affine(), plaintext: nextValue });
  }

  protected onAffineCiphertextInput(event: Event): void {
    const nextValue = (event.target as HTMLTextAreaElement | null)?.value ?? '';
    this.affine.set({ ...this.affine(), ciphertext: nextValue });
  }

  protected onAffineAInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement | null)?.value ?? '0');
    this.affine.set({ ...this.affine(), a: Number.isFinite(value) ? value : 0 });
  }

  protected onAffineBInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement | null)?.value ?? '0');
    this.affine.set({ ...this.affine(), b: Number.isFinite(value) ? value : 0 });
  }

  protected encryptAffineSection(): void {
    const a = ((Number(this.affine().a) % 27) + 27) % 27 || 1;
    const b = ((Number(this.affine().b) % 27) + 27) % 27;
    const plaintext = normalizeText(this.affine().plaintext);
    const ciphertext = encryptAffine(plaintext, a, b);

    this.affine.set({ plaintext, ciphertext, a, b });
    this.affineAnalysisVisible.set(false);
    this.affineAnalysis.set(analyzeCiphertext(ciphertext));
  }

  protected decryptAffineSection(): void {
    const a = ((Number(this.affine().a) % 27) + 27) % 27 || 1;
    const b = ((Number(this.affine().b) % 27) + 27) % 27;
    const ciphertext = normalizeText(this.affine().ciphertext);
    const plaintext = decryptAffine(ciphertext, a, b);

    this.affine.set({ plaintext, ciphertext, a, b });
    this.affineAnalysisVisible.set(false);
    this.affineAnalysis.set(analyzeCiphertext(ciphertext));
  }

  protected analyzeAffineSection(): void {
    const ciphertext = normalizeText(this.affine().ciphertext || this.affine().plaintext);
    this.affineAnalysis.set(analyzeCiphertext(ciphertext));
    this.affineAnalysisVisible.set(true);
  }

  protected clearAffine(): void {
    this.affine.set({ plaintext: '', ciphertext: '', a: 1, b: 0 });
    this.affineAnalysisVisible.set(false);
    this.affineAnalysis.set(analyzeCiphertext(''));
  }

  protected onVigenerePlaintextInput(event: Event): void {
    const nextValue = (event.target as HTMLTextAreaElement | null)?.value ?? '';
    this.vigenere.set({ ...this.vigenere(), plaintext: nextValue });
  }

  protected onVigenereCiphertextInput(event: Event): void {
    const nextValue = (event.target as HTMLTextAreaElement | null)?.value ?? '';
    this.vigenere.set({ ...this.vigenere(), ciphertext: nextValue });
  }

  protected onVigenereKeyInput(event: Event): void {
    const nextValue = (event.target as HTMLInputElement | null)?.value ?? '';
    this.vigenere.set({ ...this.vigenere(), key: nextValue });
  }

  protected encryptVigenereSection(): void {
    const plaintext = normalizeText(this.vigenere().plaintext);
    const key = normalizeText(this.vigenere().key);
    const ciphertext = encryptVigenere(plaintext, key);

    this.vigenere.set({ plaintext, ciphertext, key });
    this.vigenereAnalysisVisible.set(false);
    this.vigenereAnalysis.set(analyzeCiphertext(ciphertext));
  }

  protected decryptVigenereSection(): void {
    const ciphertext = normalizeText(this.vigenere().ciphertext);
    const key = normalizeText(this.vigenere().key);
    const plaintext = decryptVigenere(ciphertext, key);

    this.vigenere.set({ plaintext, ciphertext, key });
    this.vigenereAnalysisVisible.set(false);
    this.vigenereAnalysis.set(analyzeCiphertext(ciphertext));
  }

  protected analyzeVigenereSection(): void {
    const ciphertext = normalizeText(this.vigenere().ciphertext || this.vigenere().plaintext);
    this.vigenereAnalysis.set(analyzeCiphertext(ciphertext));
    this.vigenereAnalysisVisible.set(true);
  }

  protected clearVigenere(): void {
    this.vigenere.set({ plaintext: '', ciphertext: '', key: '' });
    this.vigenereAnalysisVisible.set(false);
    this.vigenereAnalysis.set(analyzeCiphertext(''));
  }

  private buildFrequencyChart(text: string): FrequencyColumn[] {
    const cleanText = normalizeText(text);
    const counts = frequencyMap(cleanText);
    const maxCount = Math.max(...counts, 1);

    return ALPHABET.split('')
      .map((letter, index) => ({
        letter,
        count: counts[index],
        width: maxCount > 0 ? (counts[index] / maxCount) * 100 : 0,
      }))
      .filter((item) => item.count > 0)
      .sort((left, right) => right.count - left.count)
      .slice(0, 8);
  }

  private getChartMax(items: FrequencyColumn[]): number {
    return Math.max(...items.map((item) => item.count), 1);
  }
}
