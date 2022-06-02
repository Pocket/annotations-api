import request from 'supertest';
import express from 'express';
import batchDeleteRouter from './batchDelete';
import sinon from 'sinon';
import * as client from '../../database/client';
import { NotesDataService } from '../../dataservices/notes';
import { HighlightsDataService } from '../../dataservices/highlights';
import { setTimeout } from 'timers/promises';
import * as Sentry from '@sentry/node';

describe('batchDelete Routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/', batchDeleteRouter);
  let notesStub: sinon.SinonStub;
  let highlightsStub: sinon.SinonStub;
  let consoleSpy;
  let sentrySpy;
  let breadcrumbSpy;

  beforeAll(() => {
    // Stub out write client so that it doesn't need a db connection
    sinon.stub(client, 'writeClient').returns(() => {});
    sinon.stub(client, 'dynamoClient').returns(() => {});
    consoleSpy = sinon.spy(console, 'log');
    sentrySpy = sinon.spy(Sentry, 'captureException');
    breadcrumbSpy = sinon.spy(Sentry, 'addBreadcrumb');
  });
  afterEach(() => {
    sinon.resetHistory();
  });
  afterAll(() => {
    sinon.restore();
  });
  describe('happy path', () => {
    beforeAll(() => {
      notesStub?.restore();
      highlightsStub?.restore();
      notesStub = sinon
        .stub(NotesDataService.prototype, 'clearUserData')
        .resolves();
      highlightsStub = sinon
        .stub(HighlightsDataService.prototype, 'clearUserData')
        .resolves();
    });
    it('Makes a call to asynchronously delete data', async () => {
      const res = await request(app)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({ userId: 123, isPremium: true, traceId: 'abc-123' });
      expect(res.status).toBe(200);
      expect(JSON.parse(res.text).message).toEqual(
        `BatchDelete: Deleting highlights and notes for userId=123 (requestId='abc-123')`
      );
      expect(notesStub.callCount).toEqual(1);
      expect(notesStub.firstCall.args).toEqual([]);
      expect(highlightsStub.callCount).toEqual(1);
      expect(highlightsStub.firstCall.args).toEqual([]);
      expect(sentrySpy.called).toBeFalsy();
      expect(consoleSpy.callCount).toEqual(2);
      // Order isn't guaranteed; just combine all the console logs
      const logText = consoleSpy.args
        .flatMap((_) => _)
        .reduce((combined, text) => combined + text, '');
      expect(logText).toContain('Notes deletion completed for userId=123');
      expect(logText).toContain('Highlights deletion completed for userId=123');
    });
  });
  describe('if highlights clear throws error', () => {
    beforeAll(() => {
      notesStub?.restore();
      highlightsStub?.restore();
      notesStub = sinon
        .stub(NotesDataService.prototype, 'clearUserData')
        .resolves();
      highlightsStub = sinon
        .stub(HighlightsDataService.prototype, 'clearUserData')
        .rejects(new Error('does not compute'));
    });
    it('still makes a call to delete note data', async () => {
      const res = await request(app)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({ userId: 123, isPremium: true, traceId: 'abc-123' });
      expect(res.status).toBe(200);
      expect(JSON.parse(res.text).message).toEqual(
        `BatchDelete: Deleting highlights and notes for userId=123 (requestId='abc-123')`
      );
      expect(notesStub.callCount).toEqual(1);
      expect(notesStub.firstCall.args).toEqual([]);
      expect(highlightsStub.callCount).toEqual(1);
      expect(highlightsStub.firstCall.args).toEqual([]);
    });
    it('logs error to Sentry and console', async () => {
      const res = await request(app)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({ userId: 123, isPremium: true, traceId: 'abc-123' });

      expect(res.status).toBe(200);
      // There will be multiple calls to the console, so just check if we got the error
      const logText = consoleSpy.args
        .flatMap((_) => _)
        .reduce((combined, text) => combined + text, '');
      expect(logText).toContain('does not compute');
      expect(logText).toContain('Failed to delete Highlights for userId=123');
      expect(consoleSpy.callCount).toEqual(3);
      expect(sentrySpy.callCount).toEqual(1);
      expect(sentrySpy.getCall(0).args[0].message).toContain(
        'does not compute'
      );
      expect(breadcrumbSpy.callCount).toEqual(1);
      expect(breadcrumbSpy.getCall(0).args[0].message).toContain(
        'Failed to delete Highlights for userId=123'
      );
    });
  });
  describe('if notes clear throws error', () => {
    beforeAll(() => {
      notesStub?.restore();
      highlightsStub?.restore();
      notesStub = sinon
        .stub(NotesDataService.prototype, 'clearUserData')
        .rejects(new Error('does not compute'));
      highlightsStub = sinon
        .stub(HighlightsDataService.prototype, 'clearUserData')
        .resolves();
    });
    it('still makes a call to delete highlights data', async () => {
      const res = await request(app)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({ userId: 123, isPremium: true, traceId: 'abc-123' });
      // Promises should resolve immediately since it's stubbed
      expect(res.status).toBe(200);
      expect(notesStub.callCount).toEqual(1);
      expect(notesStub.firstCall.args).toEqual([]);
      expect(highlightsStub.callCount).toEqual(1);
      expect(highlightsStub.firstCall.args).toEqual([]);
    });
    it('logs error to Sentry and console', async () => {
      const res = await request(app)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({ userId: 123, isPremium: true, traceId: 'abc-123' });

      expect(res.status).toBe(200);
      // There will be multiple calls to the console, so just check if we got the error
      const logText = consoleSpy.args
        .flatMap((_) => _)
        .reduce((combined, text) => combined + text, '');
      expect(logText).toContain('does not compute');
      expect(logText).toContain('Failed to delete Notes for userId=123');
      expect(consoleSpy.callCount).toEqual(3);
      expect(sentrySpy.callCount).toEqual(1);
      expect(sentrySpy.getCall(0).args[0].message).toContain(
        'does not compute'
      );
      expect(breadcrumbSpy.callCount).toEqual(1);
      expect(breadcrumbSpy.getCall(0).args[0].message).toContain(
        'Failed to delete Notes for userId=123'
      );
    });
  });
});
