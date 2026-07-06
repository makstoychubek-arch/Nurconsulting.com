export interface KIZRecord {
  kiz: string;
  gtin: string;
  barcode: string;
  article: string;
  name: string;
  color: string;
  size: string;
  matched: boolean;
}

export interface WBProduct {
  nmId: number;
  article: string;
  name: string;
  brand: string;
  sizes: Array<{
    barcode: string;
    techSize: string;
    wbSize: string;
  }>;
}

export interface LabelTemplate {
  name: string;
  width: number;
  height: number;
  showText: boolean;
  showEAN: boolean;
  showDM: boolean;
  dmOnly: boolean;
  dmExtra: boolean;
}

export interface LogEntry {
  ts: number;
  total: number;
  matched: number;
  duplicates: number;
  errors: number;
}
