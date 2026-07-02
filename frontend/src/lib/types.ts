export type RnpRow = {
  id: string;
  section: string;
  label: string;
  bold?: boolean;
  hero?: boolean;
  values: Record<string, string | number | null>;
};

export type RnpColumn = {
  id: string;
  label: string;
  kind: 'week' | 'total' | 'day';
  isToday?: boolean;
};

export type CabinetOption = { id: string; name: string };

export type ArticleSummary = {
  nm_id: number;
  name: string;
  photo_url?: string;
  orders: number;
  profit: number;
  plan_pct: number;
};
