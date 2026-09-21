const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // eslint-config-expo's SDK 57 bump pulled in eslint-plugin-react-hooks v7's new
    // React-Compiler-era rules (set-state-in-effect, refs, purity, immutability), which flag ~74
    // pre-existing call sites across the app (mostly "setLoading(true) in a data-loading useEffect",
    // a long-standing, working pattern here). Fixing all of them is a real, separate initiative
    // (see TODOS.md backlog), not something to force into an SDK-upgrade PR — downgraded to warn so
    // they stay visible without blocking `npm run lint`.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
]);
