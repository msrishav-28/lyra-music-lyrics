/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/__tests__'],
    moduleNameMapper: {
        // Resolve the Next.js path alias @ → project root
        '^@/(.*)$': '<rootDir>/$1',
    },
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: {
                // Relax for tests — don't need full Next.js tsconfig
                module: 'CommonJS',
                esModuleInterop: true,
            },
        }],
    },
    testPathPattern: '__tests__',
};
