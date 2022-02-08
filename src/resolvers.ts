import { IContext } from './context';
import { SavedItemAnnotations, SavedItem } from './types';
import { HighlightsDataService } from './dataservices/highlights';

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
};
