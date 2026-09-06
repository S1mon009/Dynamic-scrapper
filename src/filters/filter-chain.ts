import type { FilterResult, ItemFilter, ScrapedItem } from '../core/types.js';

/** Limits applied while evaluating a filter chain. */
export interface FilterChainOptions {
  /** Stop accepting items after this number has passed. */
  maxResults?: number;
  /** Require at least this many accepted items. */
  minResults?: number;
}

/** Applies item filters in order and tracks accepted items. */
export class FilterChain {
  private passedCount = 0;

  constructor(
    private readonly filters: ItemFilter[],
    private readonly options: FilterChainOptions = {},
  ) {}

  /**
   * Whether the configured maximum number of results has been reached.
   *
   * @returns Whether no further items should be accepted.
   */
  get isMaxReached(): boolean {
    return this.options.maxResults !== undefined && this.passedCount >= this.options.maxResults;
  }

  /**
   * Number of items accepted by the chain so far.
   *
   * @returns Number of accepted items.
   */
  get passedTotal(): number {
    return this.passedCount;
  }

  /**
   * Checks whether the minimum result count has been satisfied.
   *
   * @returns Result describing whether the minimum was reached.
   */
  checkMinResults(): FilterResult {
    const { minResults } = this.options;
    if (minResults !== undefined && this.passedCount < minResults) {
      return {
        passed: false,
        reason: `only ${this.passedCount} item(s) passed filters, minimum required is ${minResults}`,
      };
    }
    return { passed: true };
  }

  /**
   * Evaluates one item against every configured filter.
   *
   * @param item - Item to evaluate.
   * @returns Filter result and, when rejected, a reason.
   */
  async evaluate(item: ScrapedItem): Promise<FilterResult> {
    if (this.isMaxReached) {
      return { passed: false, reason: 'maxResults already reached for this task' };
    }
    for (const filter of this.filters) {
      const result = await filter.apply(item);
      if (!result.passed) {
        return { passed: false, reason: `[${filter.name}] ${result.reason ?? 'did not match'}` };
      }
    }
    this.passedCount += 1;
    return { passed: true };
  }
}
