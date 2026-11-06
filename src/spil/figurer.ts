// Figurerne, eleverne kan vælge. Egne, opdigtede figurer i en absurd stil:
// halvt dyr, halvt ting, med pseudoitalienske navne. Ingen af dem er kendte
// figurer. Hver figur har en farve, som bruges på spillepladen, indtil der
// er tegninger.

export interface Figur {
  id: string;
  navn: string;
  /** Hvad figuren er, i almindeligt dansk. */
  er: string;
  farve: string;
}

export const FIGURER: Figur[] = [
  { id: 'pinguino', navn: 'Pinguino Croissantino', er: 'en pingvin, der er halvt croissant', farve: '#e0a458' },
  { id: 'tartaruga', navn: 'Tartaruga Turbina', er: 'en skildpadde med en jetmotor som skjold', farve: '#5d9b6b' },
  { id: 'lumaca', navn: 'Lumaca Lampadina', er: 'en snegl med en elpære som hus', farve: '#e8c547' },
  { id: 'gufo', navn: 'Gufo Gelatone', er: 'en ugle, der sidder i en isvaffel', farve: '#c98bb9' },
  { id: 'riccio', navn: 'Riccio Razzetto', er: 'et pindsvin, der er en lille raket', farve: '#d9603b' },
  { id: 'fenicottero', navn: 'Fenicottero Fisarmonica', er: 'en flamingo med harmonika i stedet for krop', farve: '#e57a9c' },
  { id: 'granchio', navn: 'Granchio Grattugia', er: 'en krabbe, der er et rivejern', farve: '#8a8f99' },
  { id: 'pecorella', navn: 'Pecorella Pizzaiola', er: 'et får med pizza som uld', farve: '#d6b483' },
  { id: 'koala', navn: 'Koala Calcolatrice', er: 'en koala, der er en lommeregner', farve: '#6b8fb3' },
  { id: 'bradipo', navn: 'Bradipo Bicicletta', er: 'et dovendyr, der hænger på en cykel', farve: '#9b7a5a' },
  { id: 'struzzo', navn: 'Struzzo Spazzolino', er: 'en struds, der er en tandbørste', farve: '#4fa3a5' },
  { id: 'volpe', navn: 'Volpe Valigetta', er: 'en ræv, der er en mappe', farve: '#c4733b' },
];

const EFTER_ID = new Map(FIGURER.map((f) => [f.id, f]));

export function findFigur(id: string | null | undefined): Figur | null {
  return (id && EFTER_ID.get(id)) || null;
}

/** To bogstaver til figurens mærke: starten af det første ord, fx "Pi" for Pinguino Croissantino. */
export function figurInitialer(f: Figur): string {
  return f.navn.slice(0, 2);
}
