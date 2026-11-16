import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        languageOptions: {
            parserOptions: {
                projectService: {
                    allowDefaultProject: ['*.mjs'],
                },
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        // public/ is the browser test page (AudioWorklet globals), served as it is
        ignores: [
            'admin/**/*',
            'public/**/*',
            'src-webcomponents/**/*',
            'node_modules/**/*',
            'test/**/*',
            'build/**/*',
            'tmp/**/*',
            '.**/*',
        ],
    },
    {
        rules: {
            'jsdoc/require-jsdoc': 'off',
            'jsdoc/require-param': 'off',
        },
    },
];
