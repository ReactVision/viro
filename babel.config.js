module.exports = {
  presets: [
    ['@babel/preset-env', {targets: {node: 'current'}}],
    '@babel/preset-typescript',
  ],
  overrides: [
    {
      // Only the JSX transform, and only for the files that contain JSX. The
      // node factory is a .tsx, and testing what it emits means compiling it;
      // preset-typescript parses JSX but leaves it for someone else to turn
      // into createElement calls.
      test: /\.[jt]sx$/,
      plugins: ['@babel/plugin-transform-react-jsx'],
    },
  ],
};
