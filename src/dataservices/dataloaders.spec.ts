import sinon from 'sinon';
import { NotesDataService } from '../dataservices/notes';
import { dynamoClient } from '../database/client';
import { createNotesLoader } from './dataloaders';

describe('dataloaders', () => {
  describe('for HighlightNotes', () => {
    let notesStub;
    let notesLoader;
    // This is required for NotesDataServiceconstructor,
    // but fetch is never invoked because we mock the data retrieval function
    const dynamo = dynamoClient();
    beforeEach(() => {
      notesStub = sinon.stub(NotesDataService.prototype, 'getMany').resolves([
        { highlightId: 'abc', text: 'bread' },
        { highlightId: 'def', text: 'garlic' },
        { highlightId: 'hij', text: 'yummy' },
      ]);
      notesLoader = createNotesLoader(dynamo);
    });
    afterEach(() => {
      notesStub.restore();
    });
    it('reorders data by highlightId', async () => {
      const result = await notesLoader.loadMany(['hij', 'def', 'abc', 'hij']);
      const expected = [
        { highlightId: 'hij', text: 'yummy' },
        { highlightId: 'def', text: 'garlic' },
        { highlightId: 'abc', text: 'bread' },
        { highlightId: 'hij', text: 'yummy' }, // retrieved from cache
      ];
      expect(result).toStrictEqual(expected);
      // Should get subsequent duplicate keys from cache
      expect(notesStub.calledOnceWith(['hij', 'def', 'abc'])).toBe(true);
    });
    it('returns undefined object if data is missing for key', async () => {
      const result = await notesLoader.loadMany(['zzz', 'def', 'abc']);
      const expected = [
        undefined,
        { highlightId: 'def', text: 'garlic' },
        { highlightId: 'abc', text: 'bread' },
      ];
      expect(result).toStrictEqual(expected);
    });
  });
});
