import { IContext } from './context';
import { SavedItemAnnotations, SavedItem, HighlightInput, Highlight } from './types';
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
    updateSavedItemHighlight: async(
      _: any,
      params: {id: string; input: HighlightInput;},
      context: IContext
    ): Promise<Highlight> => {
      const dataService = new HighlightsDataService(context);
      await dataService.updateHighlightsById(params.id, params.input);
      return await dataService.getHighlightById(params.id);
    }
  }
};
