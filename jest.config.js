module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: {
        'source-map-support/register': 'identity-obj-proxy'
    },
    maxWorkers: 1,
    testTimeout : 15000
};