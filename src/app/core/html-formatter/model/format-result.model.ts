export class FormatWarning {
  constructor(
    public readonly message: string,
    public readonly context?: string,
  ) {}
}

export class FormatStats {
  constructor(
    public readonly inputLength: number,
    public readonly outputLength: number,
    public readonly inputLines: number,
    public readonly outputLines: number,
    public readonly elapsedMs: number,
  ) {}
}

export class FormatResult {
  constructor(
    public readonly code: string,
    public readonly stats: FormatStats,
    public readonly warnings: FormatWarning[] = [],
  ) {}

  get hasWarnings(): boolean {
    return this.warnings.length > 0;
  }
}
