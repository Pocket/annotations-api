import DataLoader from 'dataloader';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { NotesDataService } from './notes';
import { HighlightNote } from '../types';

/**
 * Function for initializing dataloader. This function should be
 * called when the context is constructed to create a new dataloader
 * instance for each request.
 * @param client DynamoDB Client to use inside NotesDataService
 * @returns DataLoader which loads HighlightNote objects by highlightId string key
 */
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

/**
 * Function for reordering keys in case the order is not preserved when loading,
 * or some keys are missing.
 * @param keys keys passed to the dataloader
 * @param notesResponse the response from the server/cache containing the data
 * @returns an array of notes (or undefined) that match the shape of the keys input
 */
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
