import { printSubgraphSchema } from '@apollo/subgraph';
import path from 'path';
import fs from 'fs';
import { schema } from './schema';

// Add in constraint directives, for pushing to apollo graph os
const sdl = printSubgraphSchema(schema);
const filePath = path.resolve(
  __dirname,
  'dist/../../..',
  'schema-generated.graphql',
);
console.log(filePath);
fs.writeFileSync(filePath, sdl);
