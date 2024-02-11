module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: ["airbnb-base", "eslint:recommended", "prettier"],
  overrides: [
    {
      env: {
        node: true,
      },
      files: [".eslintrc.{js,cjs}"],
      parserOptions: {
        sourceType: "script",
      },
    },
  ],
  parserOptions: {
    ecmaVersion: "latest",
  },
  rules: {
    "no-undef": "warn",
    "no-restricted-syntax": "warn",
    "no-continue": "off",
    semi: ["error", "always"],
    quotes: ["warn", "single"],
    "import/no-dynamic-require": 0,
    "global-require": 0,
    "import/prefer-default-export": 0,
    "no-underscore-dangle": 0,
    "no-await-in-loop": 0,
    "no-restricted-syntax": 0,
    "no-return-await": 0,
    "no-console": 0,
    "comma-dangle": 0,
    complexity: ["error", { max: 10 }],
    "no-shadow": "off",
    "max-depth": [
      "error",
      {
        max: 3,
      },
    ],
    complexity: ["error", 15],
    "prettier/prettier": [
      2,
      {
        endOfLine: "lf",
        semi: true,
        singleQuote: true,
        bracketSpacing: true,
        trailingComma: "all",
        printWidth: 100,
        arrowParens: "always",
        overrides: [
          {
            files: "*.json",
            options: {
              singleQuote: false,
            },
          },
          {
            files: ".*rc",
            options: {
              singleQuote: false,
              parser: "json",
            },
          },
        ],
      },
    ],
  },
  plugins: ['prettier'],
  ignorePatterns: ['*.min.js'],
};
