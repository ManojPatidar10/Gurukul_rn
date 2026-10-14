import type * as TS from 'typescript';

/**
 * Finds English typed straight into the app's source where a user would see it, instead of coming
 * from the translations - the guard behind "every screen is in Hindi" (i18nHardcoded.test.ts). It
 * reads the TypeScript syntax tree, so text split over lines or nested in JSX is found too.
 *
 * It looks at:
 * - JSX text: <Text>Hello</Text>;
 * - strings and template literals in JSX attributes (placeholder="...", title={...}), except
 *   non-text props (style, name, keyboardType, ...) and on... handlers;
 * - strings and template literals shown as JSX children: <Text>{busy ? 'Saving…' : label}</Text>;
 * - text/label/title/subtitle/description/message/placeholder/hint object properties;
 * - arguments of Alert.alert(...), showToast(...) and state setters (setError(...));
 * - sentence-like strings a function returns (not HTML).
 *
 * It ignores keys and other arguments of t(), navigate() and every other call; identifier-like
 * strings ('primary', 'calendar-alt', 'DriverHome') and ALL_CAPS codes ('PRESENT'); the operands
 * of comparisons and case labels; and example data with a digit and no spaces ('K7M2QXPZ').
 * It's a heuristic: a false positive goes in the test's allowlist with a reason.
 */

export interface HardcodedText {
  line: number;
  text: string;
  /** Where it was found: 'jsx-text', 'attr:placeholder', 'prop:title', 'call:Alert.alert', ... */
  where: string;
}

// Codes and names that stay Latin in every language.
const ALLOWED_CODES = /\b(?:XP|AI|PDF|RFID|UPI|IFSC|OK|ID|GPS|SMS|OTP|QR|URL|API|MB|KB|AB|EX|RSVP|Smart Gurukul)\b/g;

// JSX attributes that never hold words for the user.
const NON_TEXT_ATTRS = new Set([
  'accentKey', 'accessibilityRole', 'activeOpacity', 'animationType', 'autoCapitalize', 'autoComplete', 'barStyle',
  'behavior', 'color', 'colors', 'contentInsetAdjustmentBehavior', 'copyKey', 'dataDetectorType', 'display', 'edges',
  'ellipsizeMode', 'end', 'enterKeyHint', 'hitSlop', 'i18nKey', 'icon', 'id', 'importantForAccessibility',
  'initialRouteName', 'inputMode', 'key', 'keyboardShouldPersistTaps', 'keyboardType', 'kind', 'locale', 'locations',
  'mode', 'name', 'nativeID', 'origin', 'placeholderTextColor', 'pointerEvents', 'presentation', 'resizeMode',
  'returnKeyType', 'route', 'screen', 'selectionColor', 'size', 'source', 'start', 'style', 'testID', 'textAlign',
  'textContentType', 'tintColor', 'type', 'uri', 'variant',
]);

// Object properties that hold words for the user.
const TEXT_PROPS = new Set(['text', 'label', 'title', 'subtitle', 'description', 'message', 'placeholder', 'hint']);

/** Whether a string has English words in it, rather than being a code, a key or data. */
export function hasEnglishWords(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  if (/^[a-z][A-Za-z0-9_.:/-]*$/.test(s)) return false; // identifier-like: 'primary', 'calendar-alt', a key
  if (/^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+$/.test(s)) return false; // a screen or component name: 'DriverHome'
  if (/^[A-Z0-9_]+$/.test(s)) return false; // an ALL_CAPS code: 'PRESENT'
  if (!/\s/.test(s) && /\d/.test(s)) return false; // example data: 'K7M2QXPZ', '#FFE9B0'
  const words = s
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(ALLOWED_CODES, '');
  return /[A-Za-z]{2,}/.test(words);
}

/** A string a function returns that reads like a sentence or a capitalised word, not HTML or a code. */
function sentenceLike(text: string): boolean {
  const s = text.trim();
  if (s.includes('<')) return false;
  return /^[A-Z][a-z]+$/.test(s) || (/\s/.test(s) && /(^[A-Z][a-z])|(\s[a-z]{3,})/.test(s));
}

export function findHardcodedText(ts: typeof TS, fileName: string, source: string): HardcodedText[] {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const found: HardcodedText[] = [];
  const add = (node: TS.Node, text: string, where: string) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    found.push({ line: line + 1, text: text.replace(/\s+/g, ' ').trim(), where });
  };

  const literalText = (node: TS.Node): string | null => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' ');
    return null;
  };

  const attributeContext = (attribute: TS.JsxAttribute): string | null => {
    const name = attribute.name.getText(sf);
    return NON_TEXT_ATTRS.has(name) || /^on[A-Z]/.test(name) ? null : `attr:${name}`;
  };

  /** Where a string literal ends up, or null when it isn't shown to the user. */
  const context = (literal: TS.Node, text: string): string | null => {
    let child: TS.Node = literal;
    for (let parent = literal.parent; parent; child = parent, parent = parent.parent) {
      if (
        ts.isParenthesizedExpression(parent) ||
        ts.isAsExpression(parent) ||
        ts.isNonNullExpression(parent) ||
        ts.isSatisfiesExpression(parent) ||
        ts.isTemplateSpan(parent) ||
        ts.isTemplateExpression(parent)
      ) {
        continue;
      }
      if (ts.isConditionalExpression(parent)) {
        if (child === parent.condition) return null;
        continue;
      }
      if (ts.isBinaryExpression(parent)) {
        const op = parent.operatorToken.kind;
        const passesThrough =
          op === ts.SyntaxKind.BarBarToken ||
          op === ts.SyntaxKind.QuestionQuestionToken ||
          op === ts.SyntaxKind.AmpersandAmpersandToken ||
          op === ts.SyntaxKind.PlusToken;
        if (passesThrough) continue;
        return null; // a comparison operand, an assignment, `in`, ...
      }
      if (ts.isJsxAttribute(parent)) return attributeContext(parent);
      if (ts.isJsxExpression(parent)) {
        const holder = parent.parent;
        if (ts.isJsxAttribute(holder)) return attributeContext(holder);
        if (ts.isJsxElement(holder) || ts.isJsxFragment(holder)) return 'jsx-expr';
        return null;
      }
      if (ts.isPropertyAssignment(parent)) {
        const name = parent.name.getText(sf).replace(/['"]/g, '');
        return child === parent.initializer && TEXT_PROPS.has(name) ? `prop:${name}` : null;
      }
      if (ts.isCallExpression(parent)) {
        if (child === parent.expression) return null;
        const callee = parent.expression.getText(sf);
        return callee === 'Alert.alert' || /(^|\.)showToast$/.test(callee) || /^set[A-Z]\w*$/.test(callee)
          ? `call:${callee}`
          : null; // t('key'), navigate('Screen'), and every other call
      }
      if (ts.isReturnStatement(parent) || (ts.isArrowFunction(parent) && child === parent.body)) {
        return sentenceLike(text) ? 'return' : null;
      }
      return null; // a variable, an array, a case label, an element access, ...
    }
    return null;
  };

  const visit = (node: TS.Node) => {
    if (ts.isJsxText(node)) {
      if (hasEnglishWords(node.text)) add(node, node.text, 'jsx-text');
    } else {
      const text = literalText(node);
      if (text !== null && hasEnglishWords(text)) {
        const where = context(node, text);
        if (where) add(node, text, where);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}
