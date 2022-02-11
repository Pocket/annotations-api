import { IContext } from './context';
import {
  SavedItemAnnotations,
  SavedItem,
  HighlightInput,
  Highlight,
} from './types';
import { HighlightsDataService } from './dataservices/highlights';
import { validateCreateSavedItemHighlights } from './utils/validation';

export const resolvers = {
  SavedItem: {
    annotations: async (
      parent: SavedItem,
      _,
      context: IContext
    ): Promise<SavedItemAnnotations> => {
      const highlights = await new HighlightsDataService(
        context
      ).getHighlightsByItemId(parent.id);
      return { highlights };
    },
  },
  Mutation: {
    createSavedItemHighlights: async (
      _,
      args: { input: HighlightInput[] },
      context: IContext
    ): Promise<Highlight[]> => {
      // For non-premium users, check if there are more than
      // the limit of requested highlights per itemId in the batch
      // Throws error if validation fails
      validateCreateSavedItemHighlights(context, args.input);
      const highlights = await new HighlightsDataService(
        context
      ).createHighlight(args.input);
      return highlights;
    },
  },
};
