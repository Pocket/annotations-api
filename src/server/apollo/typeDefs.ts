import path from 'path';
import fs from 'fs';
import { gql } from 'graphql-tag';

console.log(path.join(__dirname, '..', '..', '..', 'schema.graphql'));
export default gql(
  fs
    .readFileSync(path.join(__dirname, '..', '..', '..', 'schema.graphql'))
    .toString(),
);
