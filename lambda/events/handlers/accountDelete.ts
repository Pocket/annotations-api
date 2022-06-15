import { SQSRecord } from 'aws-lambda';
import { config } from '../config';
import fetch from 'node-fetch';

/**
 * Given an account delete event, queue SQS messages to delete user
 * data in the Annotations subgraph.
 * @param record SQSRecord containing forwarded event from eventbridge
 * @throws Error if response is not ok
 */
export async function accountDeleteHandler(record: SQSRecord) {
  const message = JSON.parse(JSON.parse(record.body).Message)['detail'];
  const postBody = {
    userId: message['userId'],
    isPremium: message['isPremium'],
  };
  if (message['traceId']) {
    postBody['traceId'] = message['traceId'];
  }
  const res = await fetch(config.endpoint + config.batchDeletePath, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(postBody),
  });
  if (!res.ok) {
    const data = (await res.json()) as any;
    throw new Error(
      `queueDelete - ${res.status}\n${JSON.stringify(data.errors)}`
    );
  }
}
