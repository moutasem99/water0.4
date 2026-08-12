// Self-hosted Tajawal (Arabic + Latin subsets, only the weights the UI actually uses).
// Bundled locally so the font renders correctly even with no network connection at all.
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/500.css';
import '@fontsource/tajawal/700.css';
import '@fontsource/tajawal/900.css';

import {
  Capacitor,
  registerPlugin,
  SystemBars,
  SystemBarsStyle
} from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Keyboard } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

const isNative = Capacitor.isNativePlatform();
const IconSwitcher = registerPlugin('IconSwitcher');
const DocumentExporter = registerPlugin('DocumentExporter');

function dataUrlPayload(dataUrl) {
  return String(dataUrl || '').split(',')[1] || '';
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function writeBase64ToDocuments(base64, fileName) {
  try {
    await Filesystem.writeFile({
      path: `WaterStation/${fileName}`,
      data: base64,
      directory: Directory.Documents,
      recursive: true
    });
    const uri = await Filesystem.getUri({
      path: `WaterStation/${fileName}`,
      directory: Directory.Documents
    });
    return { uri: uri.uri, name: fileName, directory: 'Documents/WaterStation' };
  } catch (error) {
    // Fallback to Cache on devices where Documents access is constrained.
    await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache
    });
    const uri = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Cache
    });
    return { uri: uri.uri, name: fileName, directory: 'Cache', fallback: true };
  }
}

async function writeBase64ToCache(base64, fileName) {
  await Filesystem.writeFile({
    path: fileName,
    data: base64,
    directory: Directory.Cache
  });
  const uri = await Filesystem.getUri({
    path: fileName,
    directory: Directory.Cache
  });
  return uri.uri;
}

window.NativeTools = {
  isNative,

  async setLauncherIcon(name) {
    if (!isNative) throw new Error('Launcher icon switching is Android-only');
    return IconSwitcher.setIcon({ name });
  },

  async getLauncherIcon() {
    if (!isNative) return { name: 'ocean' };
    return IconSwitcher.getIcon();
  },


  async elementToPngBase64(element, options = {}) {
    const canvas = await html2canvas(element, {
      scale: options.scale || 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false
    });
    return dataUrlPayload(canvas.toDataURL('image/png', 1));
  },

  async elementsToPdfBase64(elements) {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageW = 210;
    const pageH = 297;
    let first = true;

    for (const element of elements) {
      const canvas = await html2canvas(element, {
        scale: 1.6,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      });
      const img = canvas.toDataURL('image/jpeg', 0.92);
      const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      const x = (pageW - w) / 2;
      const y = (pageH - h) / 2;
      if (!first) pdf.addPage();
      first = false;
      pdf.addImage(img, 'JPEG', x, y, w, h, undefined, 'FAST');
    }

    return dataUrlPayload(pdf.output('datauristring'));
  },

  async saveBase64({ base64, fileName, mimeType = 'application/octet-stream' }) {
    if (isNative) {
      return DocumentExporter.saveBase64({ base64, fileName, mimeType });
    }
    return writeBase64ToDocuments(base64, fileName);
  },

  async shareBase64({ base64, fileName, mimeType, title }) {
    const uri = await writeBase64ToCache(base64, fileName);
    await Share.share({
      title: title || fileName,
      text: title || '',
      files: [uri],
      dialogTitle: title || 'مشاركة'
    });
    return { uri, mimeType };
  },

  async saveWorkbook({ sheets, fileName }) {
    const wb = XLSX.utils.book_new();

    for (const [sheetName, rows] of Object.entries(sheets || {})) {
      const safeRows = Array.isArray(rows) && rows.length ? rows : [{ 'لا توجد بيانات': '' }];
      const ws = XLSX.utils.json_to_sheet(safeRows);
      const widths = Object.keys(safeRows[0] || {}).map(key => {
        const max = Math.max(
          String(key).length,
          ...safeRows.slice(0, 500).map(row => String(row[key] ?? '').length)
        );
        return { wch: Math.min(32, Math.max(10, max + 2)) };
      });
      ws['!cols'] = widths;
      XLSX.utils.book_append_sheet(wb, ws, String(sheetName).slice(0, 31));
    }

    const array = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
    const base64 = arrayBufferToBase64(array);
    if (isNative) {
      return DocumentExporter.saveBase64({
        base64,
        fileName,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
    }
    return writeBase64ToDocuments(base64, fileName);
  }
};

if (isNative) {
  document.documentElement.classList.add('capacitor-native');

  try {
    SystemBars.setStyle({ style: SystemBarsStyle.Dark }).catch(() => {});
  } catch (_) {}

  // V55: react to the app's own day/night mode without changing scroll behavior.
  window.addEventListener('waterstation-appearance-change', (event) => {
    const resolved = event?.detail?.resolved || 'light';
    document.documentElement.classList.toggle('native-dark', resolved === 'dark');
  });

  window.addEventListener('load', async () => {
    try { await SplashScreen.hide(); } catch (_) {}
  }, { once: true });

  try {
    Keyboard.addListener('keyboardWillShow', () => {
      document.documentElement.classList.add('keyboard-open');
    });
    Keyboard.addListener('keyboardDidHide', () => {
      document.documentElement.classList.remove('keyboard-open');
    });
  } catch (_) {}

  try {
    App.addListener('backButton', async () => {
      if (document.getElementById('v47-numpad-overlay')) {
        document.getElementById('v47-numpad-overlay')?.remove();
        return;
      }
      if (document.getElementById('v47-tutorial')) {
        document.getElementById('v47-tutorial')?.remove();
        return;
      }
      const overlay = document.getElementById('modal-overlay');
      if (overlay) {
        overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return;
      }
      const activeTab = document.querySelector('[data-tab].active');
      if (activeTab && activeTab.dataset.tab !== 'sales') {
        document.querySelector('[data-tab="sales"]')?.click();
        return;
      }
      await App.exitApp();
    });
  } catch (_) {}

  let lastHaptic = 0;
  document.addEventListener('pointerdown', async (event) => {
    const el = event.target.closest(
      '.btn-prod,.cart-qty .btn-icon-only,.cart-qty-number,.v50-cart-remove,.payment-option,.v49-payment-choice,.btn-success,.shift-handoff-btn,.nav-item,.v47-key,.v50-tutorial-action'
    );
    if (!el) return;

    el.classList.add('native-press');
    setTimeout(() => el.classList.remove('native-press'), 95);

    const now = performance.now();
    if (now - lastHaptic < 60) return;
    lastHaptic = now;

    try {
      const strong =
        el.classList.contains('btn-success') ||
        el.classList.contains('shift-handoff-btn') ||
        el.classList.contains('enter');

      await Haptics.impact({
        style: strong ? ImpactStyle.Medium : ImpactStyle.Light
      });
    } catch (_) {}
  }, { passive: true });
}
