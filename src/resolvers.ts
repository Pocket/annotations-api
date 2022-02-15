import { IContext } from './context';
import {
  SavedItemAnnotations,
  SavedItem,
  HighlightInput,
  Highlight,
  HighlightNote,
} from './types';
import { HighlightsDataService } from './dataservices/highlights';
import { NotesDataService } from './dataservices/notes';

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
  Highlight: {
    note: async (
      parent: Highlight,
      _,
      context: IContext
    ): Promise<HighlightNote | null> => {
      return new NotesDataService().get(parent.id);
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
    updateSavedItemHighlight: async (
      _: any,
      params: { id: string; input: HighlightInput },
      context: IContext
    ): Promise<Highlight> => {
      const dataService = new HighlightsDataService(context);
      await dataService.updateHighlightsById(params.id, params.input);
      return await dataService.getHighlightById(params.id);
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
