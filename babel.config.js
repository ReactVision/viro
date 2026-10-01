module.exports = {
  presets: [
    ['@babel/preset-env', {targets: {node: 'current'}}],
    // `declare` fields (ViroCamera's `declare context`) are erased, as tsc erases
    // them for the build; without this the preset refuses the file.
    ['@babel/preset-typescript', {allowDeclareFields: true}],
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
