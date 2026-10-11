import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../api/errorMessage';
import { createFeeCategory } from '../api/feeCategories';
import type { FeeCategory } from '../api/types';
import { useToast } from '../context/ToastContext';
import { normaliseCategoryCode } from '../utils/feeBills';

/**
 * The "new fee category" form shared by the Fee Categories screen and the picker on the fee
 * structure form: the typed code and name, the code as the server will store it (" tuition fee "
 * -> TUITION_FEE), and `create`, which checks both, creates the category and clears the form.
 * A refusal (a code that already exists, ignoring case) shows as a toast and returns null.
 */
export function useCreateFeeCategory(schoolId: string) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const normalisedCode = normaliseCategoryCode(code);

  const reset = useCallback(() => {
    setCode('');
    setName('');
  }, []);

  const create = async (): Promise<FeeCategory | null> => {
    if (!code.trim()) {
      showToast(t('fees.categories.errors.code'), 'error');
      return null;
    }
    if (!normalisedCode) {
      showToast(t('fees.categories.errors.codeFormat'), 'error');
      return null;
    }
    if (!name.trim()) {
      showToast(t('fees.categories.errors.name'), 'error');
      return null;
    }
    setCreating(true);
    try {
      const created = await createFeeCategory(schoolId, { code: normalisedCode, name: name.trim() });
      reset();
      return created;
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
      return null;
    } finally {
      setCreating(false);
    }
  };

  return { code, setCode, name, setName, normalisedCode, creating, create, reset };
}
