# Silex Language Support

Language support for [Silex](https://silex-lang.org) in Visual Studio Code.

The initial extension provides:

- syntax highlighting for `.sx` files;
- bracket matching and automatic closing;
- indentation between braces;
- line comments with `//`.

## Development

Install the development dependencies and validate the grammar:

```sh
npm install
npm test
```

Create an installable VSIX package:

```sh
npm run package
```

The TextMate grammar in `syntaxes/silex.tmLanguage.json` is intended to remain
usable independently from VS Code, notably as the future syntax-highlighting
source for GitHub Linguist.

## Status

Silex and this extension are under active development. Language Server support
will be added separately; this first version is intentionally declarative.
