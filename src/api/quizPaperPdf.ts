import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { TFunction } from 'i18next';

import { buildQuizPaperHtml, quizPaperFileName } from '../utils/quizPaper';
import type { AiQuizGenerationResponse } from './types';

/** A4 at 72 PPI, the unit expo-print measures pages in. */
const A4_PAGE = { width: 595, height: 842 };

/** This device has no share sheet to hand the PDF to. */
export class ShareUnavailableError extends Error {
  constructor() {
    super('Sharing is not available on this device');
  }
}

/**
 * Renders the generated paper to a PDF on the phone (no network needed) and opens the share sheet.
 * `includeAnswerKey` adds the answer key on its own page(s) after the questions.
 */
export async function shareQuizPaper(paper: AiQuizGenerationResponse, includeAnswerKey: boolean, t: TFunction): Promise<void> {
  const html = buildQuizPaperHtml(paper, { includeAnswerKey }, t);
  const { uri } = await Print.printToFileAsync({ html, ...A4_PAGE });

  // A readable file name for whoever receives it; the print file's own name is random.
  let shareUri = uri;
  try {
    const named = new File(Paths.cache, quizPaperFileName(paper.title, paper.className, includeAnswerKey));
    await new File(uri).move(named, { overwrite: true });
    shareUri = named.uri;
  } catch (e) {
    console.warn('[quizPaper] Could not rename the PDF, sharing it under its print name', e);
  }

  if (!(await Sharing.isAvailableAsync())) throw new ShareUnavailableError();
  await Sharing.shareAsync(shareUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: paper.title });
}
