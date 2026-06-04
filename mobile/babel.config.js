module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': './src',
            // Maps @shared/* → ../lib/* so we can import shared types
            // without duplicating them: import type { Truck } from '@shared/types'
            '@shared': '../lib',
          },
        },
      ],
    ],
  };
};
