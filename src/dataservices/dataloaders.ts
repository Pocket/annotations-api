import DataLoader from 'dataloader';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { NotesDataService } from './notes';
import { HighlightNote } from '../types';

export function createNotesLoader(
  client: DynamoDBClient
): DataLoader<string, HighlightNote | undefined> {
  return new DataLoader<string, HighlightNote | undefined>(
    async (keys: string[]) => {
      const notes = await new NotesDataService(client).getMany(keys);
      // there might be missing/different ordered keys
      // we need these to be explicitly included, even if undefined,
      // so that the response has the same expected length and order
      return orderAndMapNotes(keys, notes);
    }
  );
}

function orderAndMapNotes(
  keys: string[],
  notesResponse: HighlightNote[]
): Array<HighlightNote | undefined> {
  const noteKeyMap = notesResponse.reduce((keyMap, currentNote) => {
    keyMap[currentNote.highlightId] = currentNote;
    return keyMap;
  }, {});
  return keys.map((key) => noteKeyMap[key]);
}
