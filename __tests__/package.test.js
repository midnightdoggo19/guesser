const fs = require('fs');
const path = require('path');
const validateNpmPackage = require('validate-npm-package-name');

const packageJsonPath = path.resolve(__dirname, '../package.json');
let packageJson;

// Load the package.json file
beforeAll(() => {
    const fileContent = fs.readFileSync(packageJsonPath, 'utf8');
    packageJson = JSON.parse(fileContent);
});

describe('package.json tests', () => {
    test('should have a valid structure', () => {
        expect(packageJson).toHaveProperty('name');
        expect(packageJson).toHaveProperty('version');
        expect(packageJson).toHaveProperty('description');
        expect(packageJson).toHaveProperty('main');
        expect(packageJson).toHaveProperty('scripts');
        expect(packageJson).toHaveProperty('dependencies');
        expect(packageJson).toHaveProperty('devDependencies');
    });

    test('name should be valid', () => {
        const result = validateNpmPackage(packageJson.name);
        expect(result.validForNewPackages).toBe(true);
    });

    test('version should follow semantic versioning', () => {
        const semverRegex = /^\d+\.\d+\.\d+$/;
        expect(packageJson.version).toMatch(semverRegex);
    });

    test('should have a start script', () => {
        expect(packageJson.scripts).toHaveProperty('start');
    });

    test('dependencies should not include duplicates in devDependencies', () => {
        const deps = Object.keys(packageJson.dependencies || {});
        const devDeps = Object.keys(packageJson.devDependencies || {});
        const duplicates = deps.filter(dep => devDeps.includes(dep));
        expect(duplicates).toEqual([]);
    });

    test('dependencies and devDependencies should have valid versions', () => {
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        const versionRegex = /^[^ ]+$/; // Simple regex to check for valid version formats
        Object.values(dependencies).forEach(version => {
            expect(version).toMatch(versionRegex);
        });
    });
});
