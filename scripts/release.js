#!/usr/bin/env node

/**
 * Release script for eviqo monorepo
 *
 * Usage:
 *   npm run release <version>    - Set specific version (e.g., 1.2.0)
 *   npm run release patch        - Bump patch version (1.0.4 -> 1.0.5)
 *   npm run release minor        - Bump minor version (1.0.4 -> 1.1.0)
 *   npm run release major        - Bump major version (1.0.4 -> 2.0.0)
 *
 * This script will:
 *   1. Update version in package.json files and config.yaml
 *   2. Run npm update to update dependencies
 *   3. Commit and push changes to dev branch
 *   4. Merge dev into main
 *   5. Create and push version tag on main
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');

// Files to update
const PACKAGE_FILES = [
  'package.json',
  'packages/eviqo-client-api/package.json',
  'packages/eviqo-mqtt/package.json',
];
const CONFIG_FILE = 'config.yaml';

// Parse command line arguments
const args = process.argv.slice(2);
const versionArg = args[0];

if (!versionArg) {
  console.error('Usage: npm run release <version|patch|minor|major>');
  console.error('');
  console.error('Examples:');
  console.error('  npm run release 1.2.0      # Set specific version');
  console.error('  npm run release patch      # Bump patch (1.0.4 -> 1.0.5)');
  console.error('  npm run release minor      # Bump minor (1.0.4 -> 1.1.0)');
  console.error('  npm run release major      # Bump major (1.0.4 -> 2.0.0)');
  process.exit(1);
}

/**
 * Parse semver string into components
 */
function parseSemver(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid semver: ${version}`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Get current version from root package.json
 */
function getCurrentVersion() {
  const pkgPath = path.join(ROOT_DIR, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return pkg.version;
}

/**
 * Calculate new version based on bump type or explicit version
 */
function getNewVersion(versionArg) {
  const bumpTypes = ['major', 'minor', 'patch'];

  if (bumpTypes.includes(versionArg)) {
    const current = parseSemver(getCurrentVersion());

    switch (versionArg) {
      case 'major':
        return `${current.major + 1}.0.0`;
      case 'minor':
        return `${current.major}.${current.minor + 1}.0`;
      case 'patch':
        return `${current.major}.${current.minor}.${current.patch + 1}`;
    }
  }

  // Validate explicit version
  parseSemver(versionArg);
  return versionArg;
}

/**
 * Update version in a package.json file
 */
function updatePackageJson(filePath, newVersion) {
  const fullPath = path.join(ROOT_DIR, filePath);
  const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const oldVersion = pkg.version;
  pkg.version = newVersion;
  fs.writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`  ${filePath}: ${oldVersion} -> ${newVersion}`);
}

/**
 * Update version in config.yaml
 */
function updateConfigYaml(newVersion) {
  const fullPath = path.join(ROOT_DIR, CONFIG_FILE);
  let content = fs.readFileSync(fullPath, 'utf8');
  const oldMatch = content.match(/^version:\s*["']?([^"'\n]+)["']?/m);
  const oldVersion = oldMatch ? oldMatch[1] : 'unknown';
  content = content.replace(
    /^version:\s*["']?[^"'\n]+["']?/m,
    `version: "${newVersion}"`
  );
  fs.writeFileSync(fullPath, content);
  console.log(`  ${CONFIG_FILE}: ${oldVersion} -> ${newVersion}`);
}

/**
 * Execute git command
 */
function git(command) {
  try {
    return execSync(`git ${command}`, { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
  } catch (error) {
    console.error(`Git command failed: git ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

/**
 * Check if working directory is clean
 */
function checkCleanWorkingDir() {
  const status = git('status --porcelain');
  if (status) {
    console.error('Error: Working directory is not clean. Please commit or stash changes first.');
    console.error(status);
    process.exit(1);
  }
}

/**
 * Get current branch name
 */
function getCurrentBranch() {
  return git('rev-parse --abbrev-ref HEAD');
}

/**
 * Execute npm command
 */
function npm(command) {
  try {
    console.log(`  Running: npm ${command}`);
    execSync(`npm ${command}`, { cwd: ROOT_DIR, encoding: 'utf8', stdio: 'inherit' });
  } catch (error) {
    console.error(`\nNpm command failed: npm ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

// Main execution
try {
  const currentVersion = getCurrentVersion();
  const newVersion = getNewVersion(versionArg);
  const currentBranch = getCurrentBranch();

  console.log(`\nReleasing version ${newVersion} (current: ${currentVersion})\n`);

  // Verify we're on dev branch
  if (currentBranch !== 'dev') {
    console.error(`Error: Must be on 'dev' branch to release. Currently on '${currentBranch}'.`);
    console.error('Please switch to dev branch first: git checkout dev');
    process.exit(1);
  }

  // Check working directory is clean
  checkCleanWorkingDir();

  // Update all files
  console.log('Step 1: Updating version in files:');
  PACKAGE_FILES.forEach(file => updatePackageJson(file, newVersion));
  updateConfigYaml(newVersion);

  // Run npm update
  console.log('\nStep 2: Running npm update...');
  npm('update');

  // Stage all changes (including package-lock.json from npm update)
  console.log('\nStep 3: Committing changes...');
  PACKAGE_FILES.forEach(file => git(`add ${file}`));
  git(`add ${CONFIG_FILE}`);
  git('add package-lock.json');
  git('add packages/*/package-lock.json');

  // Commit
  git(`commit -m "chore: bump version to ${newVersion}"`);
  console.log(`  Created commit: chore: bump version to ${newVersion}`);

  // Push dev branch
  console.log('\nStep 4: Pushing to dev branch...');
  git('push origin dev');
  console.log('  Pushed dev branch to origin');

  // Switch to main branch
  console.log('\nStep 5: Merging dev into main...');
  git('checkout main');
  console.log('  Switched to main branch');

  // Pull latest main
  git('pull origin main');
  console.log('  Pulled latest main');

  // Merge dev into main
  git(`merge dev --no-ff -m "Merge dev for release v${newVersion}"`);
  console.log('  Merged dev into main');

  // Create tag on main
  console.log('\nStep 6: Creating release tag...');
  git(`tag -a v${newVersion} -m "Release v${newVersion}"`);
  console.log(`  Created tag: v${newVersion}`);

  // Push main and tags
  console.log('\nStep 7: Pushing main branch and tags...');
  git('push origin main');
  git('push origin --tags');
  console.log('  Pushed main branch and tags to origin');

  // Switch back to dev
  console.log('\nStep 8: Switching back to dev branch...');
  git('checkout dev');
  console.log('  Switched back to dev branch');

  console.log(`\n✓ Release ${newVersion} complete!\n`);
  console.log('Summary:');
  console.log(`  - Version bumped to ${newVersion}`);
  console.log(`  - Dependencies updated`);
  console.log(`  - Changes committed and pushed to dev`);
  console.log(`  - Dev merged into main`);
  console.log(`  - Tag v${newVersion} created and pushed`);
  console.log(`  - Back on dev branch\n`);

} catch (error) {
  console.error(`\nError: ${error.message}\n`);
  process.exit(1);
}
