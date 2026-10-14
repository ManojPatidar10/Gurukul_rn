import type * as TS from 'typescript';

import { findHardcodedText, type HardcodedText } from '../testUtils/hardcodedText';

// Reads and parses the app's source with Node's fs and the TypeScript compiler, the way
// i18nParity.test.ts reads it: typed here rather than through @types/node, which would put Node
// globals into the type check for all the app code.
declare const __dirname: string;
const fs = jest.requireActual<{
  readdirSync(dir: string, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
  readFileSync(file: string, encoding: 'utf8'): string;
}>('fs');
const ts = jest.requireActual<typeof TS>('typescript');

/**
 * Fails when English is typed straight into a screen again instead of coming from en.json/hi.json,
 * which would show English in the middle of a Hindi screen. See src/testUtils/hardcodedText.ts for
 * what counts. To fix a failure, move the text to a key (both locale files); if it really must stay
 * English, add it below with the reason.
 */

/** Files that stay English on purpose, by path under src/, with the reason. */
const ALLOWED_FILES: Record<string, string> = {
  'screens/principal/PushDebugScreen.tsx':
    'A hidden support screen (long-press the version footer) for us, not for users; English only by design.',
  'screens/principal/ConnectGoogleAccountScreen.tsx': 'Video calls are switched off - translate before turning videoCalls on.',
  'screens/principal/VideoCallHubScreen.tsx': 'Video calls are switched off - translate before turning videoCalls on.',
  'screens/principal/PickCallTargetScreen.tsx': 'Video calls are switched off - translate before turning videoCalls on.',
  'screens/principal/ScheduleCallScreen.tsx': 'Video calls are switched off - translate before turning videoCalls on.',
  'screens/principal/ScheduledCallsScreen.tsx': 'Video calls are switched off - translate before turning videoCalls on.',
  'screens/principal/CallHistoryScreen.tsx': 'Video calls are switched off - translate before turning videoCalls on.',
  'screens/principal/InCallScreen.tsx': 'Video calls are switched off - translate before turning videoCalls on.',
  'components/IncomingCallOverlay.tsx': 'Video calls are switched off - translate before turning videoCalls on.',
  'hooks/useGoogleMeetGate.ts': 'Video calls are switched off - translate before turning videoCalls on.',
  'utils/selfMarkLocation.ts':
    "The self check-in refusals' canonical English. The screen words them by code (selfMarkMessages.ts), and selfMarkMessages.test.ts holds en.json to this text.",
  'utils/selfMarkIntegrity.ts':
    "The Play Integrity refusals' canonical English. The screen words them by code (selfMarkMessages.ts), and selfMarkMessages.test.ts holds en.json to this text.",
  'utils/activityLogFormat.ts':
    "The activity log's record and field names and Yes/No are technical identifiers; translating them is a follow-up.",
};

/** Single strings that look like English but aren't words for the user to read. */
const ALLOWED_STRINGS = new Set([
  'yourname@oksbi', // an example UPI handle (FeePaymentSettings placeholder)
  'name@bank', // an example UPI handle (VendorForm placeholder)
]);

function sourceFiles(): string[] {
  // Paths relative to src/, joined with '/' (which fs accepts on Windows too).
  const SRC = `${__dirname}/..`;
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir ? `${SRC}/${dir}` : SRC, { withFileTypes: true })) {
      const file = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'testUtils') walk(file);
      } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        files.push(file);
      }
    }
  };
  walk('');
  return files;
}

const show = (file: string, found: HardcodedText[]) => found.map((f) => `${file}:${f.line} [${f.where}] ${f.text}`);

describe('hard-coded English', () => {
  it('finds the English it is meant to find (checks the checker)', () => {
    const snippet = `
      import { Alert, Text, View } from 'react-native';
      export function Demo({ ok, status }: { ok: boolean; status: string }) {
        const { t } = useTranslation();
        const [, setError] = useState<string | null>(null);
        const { showToast } = useToast();
        if (!ok) setError('Something broke.');
        showToast(\`Saved \${status}.\`, 'success');
        Alert.alert('Oops', 'Try again later.', [{ text: 'Retry', style: 'cancel' }]);
        return (
          <View style={{ textTransform: 'uppercase' }}>
            <Text>Hello
              world</Text>
            <SearchBar placeholder="Search by name" icon="search" onPress={() => go('Profile')} />
            <Text accessibilityLabel={ok ? 'All good' : t('common.error')}>{ok ? 'Saved.' : t('common.saving')}</Text>
            {status === 'Not here' && <Text>{t('a.b')} · {'K7M2QXPZ'} {'PRESENT'}</Text>}
          </View>
        );
      }
      function label(s: string) {
        switch (s) {
          case 'Not a label':
            return 'All done here';
          default:
            return 'primary';
        }
      }
    `;
    const found = findHardcodedText(ts, 'Demo.tsx', snippet).map((f) => `${f.where} ${f.text}`);
    expect(found.sort()).toEqual(
      [
        'call:setError Something broke.',
        'call:showToast Saved .',
        'call:Alert.alert Oops',
        'call:Alert.alert Try again later.',
        'prop:text Retry',
        'jsx-text Hello world',
        'attr:placeholder Search by name',
        'attr:accessibilityLabel All good',
        'jsx-expr Saved.',
        'return All done here',
      ].sort()
    );
  });

  it('is not typed into any screen, apart from the files and strings allowed with a reason', () => {
    const files = sourceFiles();
    expect(files.length).toBeGreaterThan(150);
    for (const allowed of Object.keys(ALLOWED_FILES)) expect(files).toContain(allowed);

    const findings = files
      .filter((file) => !(file in ALLOWED_FILES))
      .flatMap((file) =>
        show(
          file,
          findHardcodedText(ts, file, fs.readFileSync(`${__dirname}/../${file}`, 'utf8')).filter(
            (f) => !ALLOWED_STRINGS.has(f.text)
          )
        )
      );
    expect(findings).toEqual([]);
  });
});
