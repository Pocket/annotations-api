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
      const noteData = args.input.reduce((result, highlightInput, index) => {
        if (highlightInput.note) {
          result.push({ id: highlights[index].id, text: highlightInput.note });
        }
        return result;
      }, [] as { id: string; text: string }[]);
      let notes: HighlightNote[];
      if (noteData.length > 0) {
        notes = await new NotesDataService(
          context.dynamoClient,
          context
        ).batchCreate(noteData);
      }
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
    ): Promise<HighlightNote> => {
      const dataService = new HighlightsDataService(context);
      await dataService.getHighlightById(args.id);
      return new NotesDataService(context.dynamoClient, context).create(
        args.id,
        args.input
      );
    },
    updateSavedItemHighlightNote: async (
      _,
      args: { id: string; input: string },
      context: IContext
    ): Promise<HighlightNote> => {
      const dataService = new HighlightsDataService(context);
      await dataService.getHighlightById(args.id);
      return new NotesDataService(context.dynamoClient, context).upsert(
        args.id,
        args.input
      );
    },
    deleteSavedItemHighlightNote: async (
      _,
      args,
      context: IContext
    ): Promise<string> => {
      const dataService = await new HighlightsDataService(context);
      await dataService.deleteHighlightById(args.id);
      return new NotesDataService(context.dynamoClient, context).delete(
        args.id
      );
    },
  },
};
