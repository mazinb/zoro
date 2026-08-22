import type { Sp500Constituent } from './types';

const SP500_CSV_URL =
  'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv';

/** Parse a CSV line respecting quoted fields. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  fields.push(current);
  return fields;
}

export async function fetchSp500Constituents(): Promise<Sp500Constituent[]> {
  const res = await fetch(SP500_CSV_URL, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch S&P 500 constituents (${res.status})`);
  }

  const text = await res.text();
  const lines = text.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('S&P 500 constituents CSV was empty');
  }

  const header = parseCsvLine(lines[0]);
  const symbolIdx = header.indexOf('Symbol');
  const nameIdx = header.indexOf('Security');
  const sectorIdx = header.indexOf('GICS Sector');
  const subIdx = header.indexOf('GICS Sub-Industry');

  if (symbolIdx < 0 || nameIdx < 0 || sectorIdx < 0) {
    throw new Error('Unexpected S&P 500 CSV header');
  }

  const constituents: Sp500Constituent[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const symbol = cols[symbolIdx]?.trim();
    if (!symbol) continue;

    constituents.push({
      symbol: symbol.replace('.', '-'),
      name: cols[nameIdx]?.trim() ?? symbol,
      sector: cols[sectorIdx]?.trim() ?? '',
      subIndustry: subIdx >= 0 ? cols[subIdx]?.trim() ?? '' : '',
    });
  }

  return constituents;
}
