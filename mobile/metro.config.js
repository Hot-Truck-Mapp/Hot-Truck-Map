const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Allow Metro to watch and resolve files from the parent /lib folder
config.watchFolders = [...(config.watchFolders ?? []), path.join(monorepoRoot, 'lib')];

// Resolve node_modules from both the mobile project and the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
