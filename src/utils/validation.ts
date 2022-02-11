import { UserInputError } from 'apollo-server-errors';
import config from '../config';
import { IContext } from '../context';
import { HighlightInput } from '../types';
import { groupByCount } from './dataAggregation';

/**
 * Input validation on createSavedItemHighlights mutation, to ensure
 * non-premium users do not exceed the highlights-per-item limit.
 * @param context GraphQL Request context
 * @param input Input to createSavedItemHighlights mutation
 * @throws UserInputError if validation fails
 * @returns void
 */
export const validateCreateSavedItemHighlights = (
  context: IContext,
  input: HighlightInput[]
) => {
  if (!context.isPremium) {
    const highlightCountByItemId = groupByCount(input, 'itemId');
    const maxCountExceeded = Object.entries(highlightCountByItemId).find(
      ([_, count]) => count > config.basicHighlightLimit
    );
    if (maxCountExceeded != null) {
      throw new UserInputError(
        `Too many highlights for itemId: ${maxCountExceeded[0]}`
      );
    }
  }
};
