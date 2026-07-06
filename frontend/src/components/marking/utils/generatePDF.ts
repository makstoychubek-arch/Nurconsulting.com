import type { KIZRecord } from '../types';
import type { LabelTemplate } from '../types';

function truncate(str: string, n: number) {
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}

function getTemplate(): LabelTemplate {
  try {
    return JSON.parse(localStorage.getItem('label_template') || '{}');
  } catch {
    return {} as LabelTemplate;
  }
}

export async function generatePDFRoll(records: KIZRecord[]) {
  const [{ jsPDF }, bwipjs] = await Promise.all([import('jspdf'), import('bwip-js')]);

  const matched = records.filter((r) => r.matched);
  if (!matched.length) return;

  const tpl = getTemplate();
  const W = tpl.width || 58;
  const H = tpl.height || 40;
  const showText = tpl.showText !== false;
  const showEAN = tpl.showEAN !== false && !tpl.dmOnly;
  const showDM = tpl.showDM !== false || tpl.dmOnly;

  const pdf = new jsPDF({
    orientation: W > H ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [W, H],
  });

  for (let i = 0; i < matched.length; i++) {
    const rec = matched[i];
    if (i > 0) pdf.addPage([W, H], W > H ? 'landscape' : 'portrait');

    if (showText) {
      pdf.setFontSize(6);
      pdf.setTextColor(0, 0, 0);
      pdf.text(truncate(rec.name, 40), 2, 5);
      pdf.text(`Арт: ${rec.article}  Р: ${rec.size}`, 2, 9);
    }

    if (showEAN) {
      try {
        const canvas = document.createElement('canvas');
        bwipjs.default.toCanvas(canvas, {
          bcid: 'ean13',
          text: rec.barcode,
          scale: 2,
          height: 8,
          includetext: true,
          textxalign: 'center',
        });
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 2, 11, 35, 14);
      } catch {
        pdf.text(rec.barcode, 2, 18);
      }
    }

    if (showDM) {
      try {
        const dm = document.createElement('canvas');
        bwipjs.default.toCanvas(dm, {
          bcid: 'datamatrix',
          text: rec.kiz,
          scale: 3,
        });
        pdf.addImage(dm.toDataURL('image/png'), 'PNG', 38, 11, 18, 18);
      } catch {
        pdf.setFontSize(4);
        pdf.text('DataMatrix', 38, 20);
      }
    }

    pdf.setFontSize(4);
    pdf.setTextColor(100, 100, 100);
    pdf.text(rec.kiz.slice(0, 40), 2, H - 2);
  }

  pdf.save(`markings_${Date.now()}.pdf`);
}
