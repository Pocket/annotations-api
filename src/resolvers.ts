import { IContext } from './context';
import {
  SavedItemAnnotations,
  SavedItem,
  HighlightInput,
  Highlight,
} from './types';
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
  Mutation: {
    createSavedItemHighlights: async (
      _,
      args: { input: HighlightInput[] },
      context: IContext
    ): Promise<Highlight[]> => {
      const highlights = await new HighlightsDataService(
        context
      ).createHighlight(args.input);
      return highlights;
    },
    deleteSavedItemHighlight: async (
      _,
      args,
      context: IContext
    ): Promise<string> => {
      const highlightId = await new HighlightsDataService(
        context
      ).deleteHighlightById(args.id);
      return highlightId;
    },
  },
};
