const fs = require('fs');
const path = require('path');

const packageJsonPath = path.resolve(__dirname, '../package.json');
let packageJson;

// Load the package.json file
beforeAll(() => {
    const fileContent = fs.readFileSync(packageJsonPath, 'utf8');
    packageJson = JSON.parse(fileContent);
});

describe('dependencies tests', () => {
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
