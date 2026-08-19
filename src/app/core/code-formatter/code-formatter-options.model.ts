export type CodeLanguage = 'typescript' | 'javascript' | 'css' | 'scss' | 'less' | 'json';

export class CodeFormatterOptions {
  constructor(
    public printWidth: number = 100,
    public tabWidth: number = 2,
    public useTabs: boolean = false,
    public singleQuote: boolean = true,
    public semi: boolean = true,
    public trailingComma: 'none' | 'es5' | 'all' = 'all',
    public bracketSpacing: boolean = true,
  ) {}

  static default(): CodeFormatterOptions {
    return new CodeFormatterOptions();
  }

  clone(overrides: Partial<CodeFormatterOptions> = {}): CodeFormatterOptions {
    return Object.assign(
      new CodeFormatterOptions(
        this.printWidth,
        this.tabWidth,
        this.useTabs,
        this.singleQuote,
        this.semi,
        this.trailingComma,
        this.bracketSpacing,
      ),
      overrides,
    );
  }
}
