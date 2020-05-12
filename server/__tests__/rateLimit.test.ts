import { graphql } from 'graphql'
const { gql, makeExecutableSchema } = require('apollo-server')
import { IResolverValidationOptions } from 'graphql-tools'
import { portaraSchemaDirective, timeFrameMultiplier } from '../rateLimiter';

// Globally allows resolvers to not exist in the original schema
const resolverValidationOptions: IResolverValidationOptions = {
  allowResolversNotInSchema: true
};
// -------------------------------------------------------------

describe('Receives a response from our GraphQL Query', () => {

  const resolvers = {
    Query: {
      test: (parent, args, context, info) => {
        return 'Test'
      }
    },
    Mutation: {
      hello: (parent, args, context, info) => {
        return 'Hello World';
      },
      bye: (parent, args, context, info) => {
        return 'Goodbye World';
      },
    },
  };

  it('Completes a query without directive', async () => {
    const typeDefs = gql`
      type Query {
        test: String!
      }
    `;

    const schema = makeExecutableSchema({
      typeDefs,
      resolvers,
      resolverValidationOptions,
    })

    const response = await graphql(schema, 'query { test }');
    expect(response.data!.test).toBe("Test")
  })

  it('Completes a mutation', async () => {
    const typeDefs = gql`
      type Query {
        test: String!
      }
      type Mutation {
        hello: String!
      }
    `;

    const schema = makeExecutableSchema({
      typeDefs,
      resolvers,
      resolverValidationOptions
    })

    const response = await graphql(schema, 'mutation { hello }');
    expect(response.data!.hello).toBe("Hello World");
  })
})

describe('Rate Limiter accepts various timeframe values', () => {
  it('returns an error when input value is not recognized', () => {
    const timeframe = timeFrameMultiplier('years')
    expect(timeframe).toBeInstanceOf(Error)
  })

  it('defaults to 1 second when value is an empty string', ()=> {
    const timeframe = timeFrameMultiplier('')
    expect(timeframe).toEqual(1000)
  })
})

describe('rate limit test?', async () => {
  const typeDefs = gql`
  directive @portara(limit: Int!, per: ID!) on FIELD_DEFINITION | OBJECT 

  type Query {
    test: String!
  }
  type Mutation  {
    hello: String! @portara(limit: 2, per: "10")
    bye: String! 
  }
`;
  const resolvers = {
    Query: {
      test: (parent, args, context, info) => {
        return 'Test'
      }
    },
    Mutation: {
      hello: (parent, args, context, info) => {
        // context.req.ip = "127.0.0.1"
        return 'Hello World';
      },
      bye: (parent, args, context, info) => {
        return 'Goodbye World';
      },
    },
  };

  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
    resolverValidationOptions,
    schemaDirectives: {
      portara: portaraSchemaDirective,
    },
  })

  it('Checks if decorated field resolvers return correct value', async () => {
    const response = await graphql(schema, 'mutation { hello }', null, { req: { ip: "127.0.0.13" } });
    expect(response.data!.hello).toBe("Hello World");
  })

  it('Checks if decorated field resolvers return error message after going over the limit', async () => {
    const response1 = await graphql(schema, 'mutation { hello }', null, { req: { ip: "127.0.0.13" } });
    const response2 = await graphql(schema, 'mutation { hello }', null, { req: { ip: "127.0.0.13" } });
    const response3 = await graphql(schema, 'mutation { hello }', null, { req: { ip: "127.0.0.13" } });
    expect(response3.data!.hello.length).toBeGreaterThan(15);
  })

})