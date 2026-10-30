// Alle navne, numre og adresser herunder er opdigtede.
import { describe, expect, it } from 'vitest';
import { findDubletter, kunFornavn, navngivDubletter, retOcrTekst, rydNavn, udtraekFraLinjer, udtraekFraTekst } from './import';

const fornavne = (t: string) => udtraekFraTekst(t).elever.map((e) => e.fornavn);

describe('udtraekFraTekst: Lectio-lignende lister', () => {
  it('tabel med billedkolonne, klasse og nummer', () => {
    const tekst = [
      'Lectio  Niels Brock - Handelsgymnasium',
      'Forside\tSkema\tBeskeder\tOpgaver',
      'Elever i 1.a (5)',
      'Billede\tElev\tKlasse\tNr.',
      '\tIda Marie Testesen\t1.a\t01',
      '\tMalte Opdigt Jensen\t1.a\t02',
      '\tSara al-Fiktiv\t1.a\t03',
      '\tAnne-Sofie Prøvesen\t1.a\t04',
      '\tOmar Eksempelsen\t1.a\t05',
      'Udskrevet 30.10.2026 kl. 10:15',
    ].join('\n');
    const r = udtraekFraTekst(tekst);
    expect(r.elever.map((e) => e.fornavn)).toEqual(['Ida', 'Malte', 'Sara', 'Anne-Sofie', 'Omar']);
    expect(r.elever[0]!.efternavnStart).toBe('Te');
    expect(r.elever[2]!.efternavnStart).toBe('Fi');
    expect(r.sprungetOver).toBe(5);
  });

  it('kopieret uden tabulatorer, med klassekode og nummer foran', () => {
    const tekst = `
      Elevliste
      1.a 01 Ida Testesen
      1.a 02 Malte Jensen
      1.a 03  Zoë Fiktivsen
      Side 1 af 1
    `;
    expect(fornavne(tekst)).toEqual(['Ida', 'Malte', 'Zoë']);
  });

  it('kolonner adskilt af flere mellemrum', () => {
    const tekst = [
      'Navn                    Klasse    Nr',
      'Ida Testesen            1x        1',
      'Mikkel Opdigtsen        1x        2',
      'Ahmad Eksempel          1x        3',
    ].join('\n');
    expect(fornavne(tekst)).toEqual(['Ida', 'Mikkel', 'Ahmad']);
  });
});

describe('udtraekFraTekst: Ludus-lignende lister', () => {
  it('"Efternavn, Fornavn" med kursistnummer, hold, fødselsdato, e-mail og status', () => {
    const tekst = [
      'Navn\tKursistnr.\tHold\tFødselsdato\tE-mail\tStatus',
      'Testesen, Ida Marie\t240113\t1hhxa24\t03-04-2009\tida.testesen@edu.eksempel.dk\tAktiv',
      'Jensen, Malte\t240114\t1hhxa24\t17-11-2008\tmalte.j@edu.eksempel.dk\tAktiv',
      'Prøvesen, Laura\t240115\t1hhxa24\t01-01-2009\tlaura@edu.eksempel.dk\tUdmeldt',
      'de Fiktiv, Noah\t240116\t1hhxa24\t22-02-2009\tnoah@edu.eksempel.dk\tAktiv',
    ].join('\n');
    const r = udtraekFraTekst(tekst);
    expect(r.elever.map((e) => e.fornavn)).toEqual(['Ida', 'Malte', 'Noah']);
    expect(r.elever.map((e) => e.efternavnStart)).toEqual(['Te', 'Je', 'Fi']);
  });

  it('efternavn med versaler først', () => {
    expect(fornavne('TESTESEN Ida\nJENSEN Malte Opdigt\nAL-FIKTIV Sara')).toEqual(['Ida', 'Malte', 'Sara']);
  });

  it('hele navnet med versaler', () => {
    expect(fornavne('IDA TESTESEN\nANNE-SOFIE PRØVESEN')).toEqual(['Ida', 'Anne-Sofie']);
  });
});

describe('udtraekFraTekst: separate kolonner og køn', () => {
  it('Fornavn-kolonnen med mellemnavne giver kun første fornavn', () => {
    // Mellemnavne er ofte slægtsnavne (fx Skov, Frost) og må ikke gemmes.
    const tekst = [
      'Fornavn\tEfternavn\tKlasse',
      'Erik Skov\tOpdigtsen\t1x',
      'Villads Frost\tTestesen\t1x',
      'Juan Francisco\tEksempel\t1x',
      'Anne-Sofie Lund\tPrøvesen\t1x',
    ].join('\n');
    expect(fornavne(tekst)).toEqual(['Erik', 'Villads', 'Juan', 'Anne-Sofie']);
    expect(udtraekFraTekst(tekst).elever.map((e) => e.efternavnStart)).toEqual(['Op', 'Te', 'Ek', 'Pr']);
  });

  it('Fornavn, Efternavn og Køn med overskrift', () => {
    const tekst = [
      'Fornavn\tEfternavn\tKøn\tKlasse',
      'Ida Marie\tTestesen\tK\t1x',
      'Malte\tJensen\tM\t1x',
      'Freja\tOpdigt\tKvinde\t1x',
    ].join('\n');
    const r = udtraekFraTekst(tekst);
    expect(r.elever).toEqual([
      { fornavn: 'Ida', efternavnStart: 'Te', koen: 'P' },
      { fornavn: 'Malte', efternavnStart: 'Je', koen: 'D' },
      { fornavn: 'Freja', efternavnStart: 'Op', koen: 'P' },
    ]);
  });

  it('to navnekolonner uden overskrift', () => {
    const tekst = 'Ida\tTestesen\t1x\nMalte\tJensen\t1x\nEmma\tPrøve\t1x';
    expect(udtraekFraTekst(tekst).elever.map((e) => [e.fornavn, e.efternavnStart])).toEqual([
      ['Ida', 'Te'], ['Malte', 'Je'], ['Emma', 'Pr'],
    ]);
  });

  it('køn som ord i en kolonne uden overskrift', () => {
    const r = udtraekFraTekst('Ida Testesen\tpige\t1x\nMalte Jensen\tdreng\t1x');
    expect(r.elever.map((e) => e.koen)).toEqual(['P', 'D']);
  });
});

describe('udtraekFraTekst: støj', () => {
  it('smider e-mails, datoer, telefonnumre, CPR-lignende numre og parenteser væk', () => {
    const tekst = [
      'Ida Testesen (it) ida@eksempel.dk 12 34 56 78',
      'Malte Jensen 010203-1234 2026-08-12',
      'Kontaktlærer: Hanne Opdigt',
      'Antal elever: 2',
      'https://www.eksempel.dk/lectio/123',
      '----',
    ].join('\n');
    expect(fornavne(tekst)).toEqual(['Ida', 'Malte']);
  });

  it('tom tekst og ren støj giver ingen navne', () => {
    expect(udtraekFraTekst('').elever).toEqual([]);
    expect(udtraekFraTekst('123\n2026-10-30\nida@eksempel.dk\n1.a\nHHX').elever).toEqual([]);
  });

  it('tåler Windows-linjeskift og hårde mellemrum', () => {
    expect(fornavne('Ida Testesen\r\nMalte Jensen\r\n')).toEqual(['Ida', 'Malte']);
  });

  it('tekst fra tekstgenkendelse med lodrette streger og løse tegn', () => {
    const tekst = '| Ida Testesen | 1.a |\n| Malte Jensen | 1.a |\n|| Klasse | Nr ||\n_ Emil Prøve';
    expect(fornavne(tekst)).toEqual(['Ida', 'Malte', 'Emil']);
  });

  it('rigtigt output fra tekstgenkendelse af en klasseliste', () => {
    // Sådan læste Tesseract et skærmbillede af en opdigtet liste.
    const ocr = 'Elever i 1.a\nElev Klasse Nr.\nldaTestesen — 1a — 01\nMalte Jensen 1a — 02\nSara Opdigt la —=03\nIda Hansen la => 04\nSøren Prøvesen 1a — 05\n';
    const r = udtraekFraTekst(retOcrTekst(ocr));
    expect(r.elever.map((e) => e.fornavn)).toEqual(['Ida', 'Malte', 'Sara', 'Ida', 'Søren']);
    expect(navngivDubletter(r.elever).map((n) => n.navn)).toEqual(['Ida T.', 'Malte', 'Sara', 'Ida H.', 'Søren']);
  });

  it('retter typiske tekstgenkendelsesfejl uden at ødelægge rigtige navne', () => {
    expect(retOcrTekst('ldaTestesen | 1a')).toBe('Ida Testesen   1a');
    expect(retOcrTekst('lbrahim Fiktiv\nlsak')).toBe('Ibrahim Fiktiv\nIsak');
    expect(retOcrTekst('Laura Lund\nlaura')).toBe('Laura Lund\nlaura');
    expect(retOcrTekst('McDonald')).toBe('McDonald');
  });

  it('køn som sidste bogstav i fritekst', () => {
    const r = udtraekFraTekst('Ida Testesen P\nMalte Jensen D\nEmil Prøve');
    expect(r.elever.map((e) => e.koen)).toEqual(['P', 'D', null]);
  });
});

describe('udtraekFraLinjer', () => {
  it('læser navn og valgfrit køn', () => {
    const r = udtraekFraLinjer('Ida P\nMalte d\nEmil\n  \nAnne-Sofie, P\nLea (D)');
    expect(r.elever).toEqual([
      { fornavn: 'Ida', koen: 'P' },
      { fornavn: 'Malte', koen: 'D' },
      { fornavn: 'Emil', koen: null },
      { fornavn: 'Anne-Sofie', koen: 'P' },
      { fornavn: 'Lea', koen: 'D' },
    ]);
  });

  it('beholder forbogstav, men kun fornavn fra fulde navne', () => {
    const r = udtraekFraLinjer('Ida H. P\nMalte Opdigt Jensen D\n1. Emil pige\n- Sara');
    expect(r.elever).toEqual([
      { fornavn: 'Ida H.', koen: 'P' },
      { fornavn: 'Malte', efternavnStart: 'Je', koen: 'D' },
      { fornavn: 'Emil', koen: 'P' },
      { fornavn: 'Sara', koen: null },
    ]);
  });

  it('springer linjer med tal over', () => {
    expect(udtraekFraLinjer('Ida\n12345').sprungetOver).toBe(1);
  });
});

describe('navngivDubletter', () => {
  it('tilføjer forbogstav i efternavnet ved samme fornavn', () => {
    const r = navngivDubletter([
      { fornavn: 'Ida', efternavnStart: 'Te', koen: 'P' },
      { fornavn: 'Ida', efternavnStart: 'Je', koen: 'P' },
      { fornavn: 'Malte', efternavnStart: 'Te', koen: 'D' },
    ]);
    expect(r).toEqual([
      { navn: 'Ida T.', dublet: false },
      { navn: 'Ida J.', dublet: false },
      { navn: 'Malte', dublet: false },
    ]);
  });

  it('bruger to bogstaver, når forbogstavet også er ens', () => {
    const r = navngivDubletter([
      { fornavn: 'Ida', efternavnStart: 'Ha', koen: 'P' },
      { fornavn: 'ida', efternavnStart: 'He', koen: 'P' },
      { fornavn: 'Ida', efternavnStart: 'Je', koen: 'P' },
    ]);
    expect(r.map((x) => x.navn)).toEqual(['Ida Ha.', 'ida He.', 'Ida J.']);
  });

  it('markerer dubletter, der ikke kan skelnes', () => {
    const r = navngivDubletter([
      { fornavn: 'Emil', koen: 'D' },
      { fornavn: 'Emil', efternavnStart: 'Ha', koen: 'D' },
      { fornavn: 'Noah', efternavnStart: 'Ha', koen: 'D' },
      { fornavn: 'Noah', efternavnStart: 'Ha', koen: 'D' },
    ]);
    expect(r).toEqual([
      { navn: 'Emil', dublet: true },
      { navn: 'Emil H.', dublet: false },
      { navn: 'Noah H.', dublet: true },
      { navn: 'Noah H.', dublet: true },
    ]);
  });
});

describe('kunFornavn', () => {
  it('beholder kun første fornavn og et evt. forbogstav', () => {
    expect(['Ida', 'Ida H.', 'Ida Ha.', 'Anne-Sofie', 'William Roland', 'Christian Erik Testesen', ' Ida  '].map(kunFornavn)).toEqual([
      'Ida', 'Ida H.', 'Ida Ha.', 'Anne-Sofie', 'William', 'Christian', 'Ida',
    ]);
  });
  it('ingen importvej giver mere end ét fornavn', () => {
    const tekster = ['Navn\nTestesen, Ida Marie Skov', 'IDA MARIE TESTESEN', 'Fornavn\tEfternavn\nIda Marie Skov\tHansen\nMalte\tJensen', '1.a 01 Ida Marie Skov Testesen'];
    for (const t of tekster) for (const e of udtraekFraTekst(t).elever) expect(e.fornavn.split(' ')).toHaveLength(1);
    for (const e of udtraekFraLinjer('Ida Marie Skov P\nMalte Opdigt Jensen').elever) expect(e.fornavn.split(' ')).toHaveLength(1);
  });
});

describe('findDubletter og rydNavn', () => {
  it('finder ens navne uanset store bogstaver og mellemrum', () => {
    expect([...findDubletter(['Ida', 'Malte', ' ida ', 'Emil', ''])].sort()).toEqual([0, 2]);
  });
  it('markerer et fornavn uden forbogstav, når en anden har samme fornavn med', () => {
    expect([...findDubletter(['Ida T.', 'Ida', 'Ida H.', 'Malte'])]).toEqual([1]);
    expect([...findDubletter(['Ida T.', 'Ida H.'])]).toEqual([]);
  });
  it('rydder op i skrevne navne', () => {
    expect(rydNavn('  ida   h. ')).toBe('Ida H.');
    expect(rydNavn('sara al Fiktiv')).toBe('Sara al Fiktiv');
  });
});
