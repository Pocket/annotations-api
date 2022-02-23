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
import { NotFoundError } from '@pocket-tools/apollo-utils';

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
    ): Promise<HighlightNote | undefined> => {
      return context.dataLoaders.noteByHighlightId.load(parent.id);
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
      const notes = await Promise.all(
        args.input.map((highlightInput, index) => {
          if (highlightInput.note) {
            return new NotesDataService(context.dynamoClient, context).create(
              highlights[index].id,
              highlightInput.note
            );
          }
        })
      );
      const returnHighlights = highlights.map((item, index) => {
        const tmpReturn = { ...item };
        if (args.input[index].note) tmpReturn.note = notes[index] ?? undefined;
        return tmpReturn;
      });
      return returnHighlights;
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
    createSavedItemHighlightNote: async (
      _,
      args: { id: string; input: string },
      context: IContext
    ): Promise<HighlightNote | Error> => {
      const dataService = new HighlightsDataService(context);
      try {
        await dataService.getHighlightById(args.id);
        return new NotesDataService(context.dynamoClient, context).create(
          args.id,
          args.input
        );
      } catch (err) {
        return err;
      }
    },
  },
};
