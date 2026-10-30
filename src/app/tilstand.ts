// Appens tilstand: én kilde til data, som gemmes efter hver ændring.
// Sletninger kan fortrydes via en besked nederst på skærmen.

import { useEffect, useState } from 'preact/hooks';
import { type AppData, type Klasse } from '../core/model';
import { gem, indlaes } from './lager';

let data: AppData = indlaes();
let lagerFejl = false;
const lyttere = new Set<() => void>();

function udsend() {
  for (const l of lyttere) l();
}

export function hentData(): AppData {
  return data;
}

/** Ændrer data via en kopi, gemmer og opdaterer skærmen. */
export function opdater(fn: (kladde: AppData) => void): void {
  const kopi = structuredClone(data);
  fn(kopi);
  saetData(kopi);
}

export function saetData(ny: AppData): void {
  data = ny;
  lagerFejl = !gem(data);
  udsend();
}

export function opdaterKlasse(id: string, fn: (k: Klasse) => void): void {
  opdater((d) => {
    const k = d.klasser.find((x) => x.id === id);
    if (k) fn(k);
  });
}

export function useData(): AppData {
  const [, saet] = useState(0);
  useEffect(() => {
    const l = () => saet((x) => x + 1);
    lyttere.add(l);
    return () => void lyttere.delete(l);
  }, []);
  return data;
}

export function harLagerFejl(): boolean {
  return lagerFejl;
}

// ----------------------------------------------------------------------
// Beskeder nederst på skærmen, evt. med "Fortryd".

export interface Besked {
  id: number;
  tekst: string;
  fortryd?: () => void;
}

let beskeder: Besked[] = [];
let naesteId = 1;
const beskedLyttere = new Set<() => void>();

export function visBesked(tekst: string, fortryd?: () => void): void {
  const id = naesteId++;
  beskeder = [...beskeder.slice(-2), { id, tekst, fortryd }];
  beskedLyttere.forEach((l) => l());
  setTimeout(() => lukBesked(id), fortryd ? 10000 : 5000);
}

export function lukBesked(id: number): void {
  beskeder = beskeder.filter((b) => b.id !== id);
  beskedLyttere.forEach((l) => l());
}

export function useBeskeder(): Besked[] {
  const [, saet] = useState(0);
  useEffect(() => {
    const l = () => saet((x) => x + 1);
    beskedLyttere.add(l);
    return () => void beskedLyttere.delete(l);
  }, []);
  return beskeder;
}

/** Udfører en ændring, der kan fortrydes, og viser en besked med "Fortryd". */
export function medFortryd(tekst: string, fn: (kladde: AppData) => void): void {
  const foer = data;
  opdater(fn);
  visBesked(tekst, () => saetData(foer));
}
