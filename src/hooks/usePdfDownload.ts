import type { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '../context/ToastContext';

/**
 * Download a server-rendered PDF and hand it to the share sheet (or say where it was saved when
 * sharing isn't available). `busy` is true while a download is running.
 */
export function usePdfDownload(shareTitle: string) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const run = async (download: () => Promise<File>) => {
    setBusy(true);
    try {
      const file = await download();
      if (!(await Sharing.isAvailableAsync())) {
        showToast(t('reportCardPdf.savedTo', { path: file.uri }), 'success');
        return;
      }
      await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: shareTitle });
    } catch (e) {
      showToast(t('reportCardPdf.failed', { message: (e as Error).message }), 'error');
    } finally {
      setBusy(false);
    }
  };

  return { busy, run };
}
