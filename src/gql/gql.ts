/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "mutation CollectionAddProducts($id: ID!, $productIds: [ID!]!) {\n  collectionAddProducts(id: $id, productIds: $productIds) {\n    collection {\n      id\n    }\n    userErrors {\n      field\n      message\n    }\n  }\n}": typeof types.CollectionAddProductsDocument,
    "mutation CollectionCreate($input: CollectionInput!) {\n  collectionCreate(input: $input) {\n    collection {\n      id\n      handle\n    }\n    userErrors {\n      field\n      message\n    }\n  }\n}": typeof types.CollectionCreateDocument,
    "mutation PublishablePublish($id: ID!, $input: [PublicationInput!]!) {\n  publishablePublish(id: $id, input: $input) {\n    userErrors {\n      field\n      message\n    }\n  }\n}": typeof types.PublishablePublishDocument,
    "query CollectionProducts($id: ID!, $first: Int!, $cursor: String) {\n  collection(id: $id) {\n    products(first: $first, after: $cursor) {\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      nodes {\n        handle\n      }\n    }\n  }\n}": typeof types.CollectionProductsDocument,
    "query ExportCollections($first: Int!, $cursor: String, $query: String) {\n  collections(first: $first, after: $cursor, query: $query) {\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    nodes {\n      id\n      title\n      handle\n      descriptionHtml\n      sortOrder\n      templateSuffix\n      image {\n        url\n        altText\n      }\n      ruleSet {\n        appliedDisjunctively\n        rules {\n          column\n          relation\n          condition\n        }\n      }\n    }\n  }\n}": typeof types.ExportCollectionsDocument,
    "query ExportPublications($first: Int!) {\n  publications(first: $first) {\n    nodes {\n      id\n      name\n    }\n  }\n}": typeof types.ExportPublicationsDocument,
    "mutation MetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {\n  metafieldDefinitionCreate(definition: $definition) {\n    createdDefinition {\n      id\n      name\n      namespace\n      key\n    }\n    userErrors {\n      field\n      message\n      code\n    }\n  }\n}": typeof types.MetafieldDefinitionCreateDocument,
    "query ExportMetafieldDefinitions($ownerType: MetafieldOwnerType!, $first: Int!, $cursor: String) {\n  metafieldDefinitions(ownerType: $ownerType, first: $first, after: $cursor) {\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    nodes {\n      name\n      namespace\n      key\n      description\n      type {\n        name\n      }\n      ownerType\n    }\n  }\n}": typeof types.ExportMetafieldDefinitionsDocument,
    "mutation ProductSet($input: ProductSetInput!) {\n  productSet(input: $input, synchronous: true) {\n    product {\n      id\n      handle\n    }\n    userErrors {\n      field\n      message\n    }\n  }\n}": typeof types.ProductSetDocument,
    "query ExportProducts($first: Int!, $cursor: String, $query: String) {\n  products(first: $first, after: $cursor, query: $query) {\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    nodes {\n      id\n      title\n      handle\n      descriptionHtml\n      productType\n      vendor\n      status\n      tags\n      options {\n        name\n        values\n      }\n      metafields(first: 50) {\n        nodes {\n          namespace\n          key\n          type\n          value\n        }\n      }\n      variants(first: 50) {\n        nodes {\n          id\n          title\n          sku\n          barcode\n          price\n          compareAtPrice\n          inventoryPolicy\n          inventoryItem {\n            tracked\n            measurement {\n              weight {\n                unit\n                value\n              }\n            }\n          }\n          selectedOptions {\n            name\n            value\n          }\n          position\n          metafields(first: 25) {\n            nodes {\n              namespace\n              key\n              type\n              value\n            }\n          }\n        }\n      }\n      images(first: 15) {\n        nodes {\n          id\n          url\n          altText\n          width\n          height\n        }\n      }\n    }\n  }\n}": typeof types.ExportProductsDocument,
    "query ProductByIdentifier($handle: String!) {\n  productByIdentifier(identifier: {handle: $handle}) {\n    id\n    handle\n  }\n}": typeof types.ProductByIdentifierDocument,
};
const documents: Documents = {
    "mutation CollectionAddProducts($id: ID!, $productIds: [ID!]!) {\n  collectionAddProducts(id: $id, productIds: $productIds) {\n    collection {\n      id\n    }\n    userErrors {\n      field\n      message\n    }\n  }\n}": types.CollectionAddProductsDocument,
    "mutation CollectionCreate($input: CollectionInput!) {\n  collectionCreate(input: $input) {\n    collection {\n      id\n      handle\n    }\n    userErrors {\n      field\n      message\n    }\n  }\n}": types.CollectionCreateDocument,
    "mutation PublishablePublish($id: ID!, $input: [PublicationInput!]!) {\n  publishablePublish(id: $id, input: $input) {\n    userErrors {\n      field\n      message\n    }\n  }\n}": types.PublishablePublishDocument,
    "query CollectionProducts($id: ID!, $first: Int!, $cursor: String) {\n  collection(id: $id) {\n    products(first: $first, after: $cursor) {\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      nodes {\n        handle\n      }\n    }\n  }\n}": types.CollectionProductsDocument,
    "query ExportCollections($first: Int!, $cursor: String, $query: String) {\n  collections(first: $first, after: $cursor, query: $query) {\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    nodes {\n      id\n      title\n      handle\n      descriptionHtml\n      sortOrder\n      templateSuffix\n      image {\n        url\n        altText\n      }\n      ruleSet {\n        appliedDisjunctively\n        rules {\n          column\n          relation\n          condition\n        }\n      }\n    }\n  }\n}": types.ExportCollectionsDocument,
    "query ExportPublications($first: Int!) {\n  publications(first: $first) {\n    nodes {\n      id\n      name\n    }\n  }\n}": types.ExportPublicationsDocument,
    "mutation MetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {\n  metafieldDefinitionCreate(definition: $definition) {\n    createdDefinition {\n      id\n      name\n      namespace\n      key\n    }\n    userErrors {\n      field\n      message\n      code\n    }\n  }\n}": types.MetafieldDefinitionCreateDocument,
    "query ExportMetafieldDefinitions($ownerType: MetafieldOwnerType!, $first: Int!, $cursor: String) {\n  metafieldDefinitions(ownerType: $ownerType, first: $first, after: $cursor) {\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    nodes {\n      name\n      namespace\n      key\n      description\n      type {\n        name\n      }\n      ownerType\n    }\n  }\n}": types.ExportMetafieldDefinitionsDocument,
    "mutation ProductSet($input: ProductSetInput!) {\n  productSet(input: $input, synchronous: true) {\n    product {\n      id\n      handle\n    }\n    userErrors {\n      field\n      message\n    }\n  }\n}": types.ProductSetDocument,
    "query ExportProducts($first: Int!, $cursor: String, $query: String) {\n  products(first: $first, after: $cursor, query: $query) {\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    nodes {\n      id\n      title\n      handle\n      descriptionHtml\n      productType\n      vendor\n      status\n      tags\n      options {\n        name\n        values\n      }\n      metafields(first: 50) {\n        nodes {\n          namespace\n          key\n          type\n          value\n        }\n      }\n      variants(first: 50) {\n        nodes {\n          id\n          title\n          sku\n          barcode\n          price\n          compareAtPrice\n          inventoryPolicy\n          inventoryItem {\n            tracked\n            measurement {\n              weight {\n                unit\n                value\n              }\n            }\n          }\n          selectedOptions {\n            name\n            value\n          }\n          position\n          metafields(first: 25) {\n            nodes {\n              namespace\n              key\n              type\n              value\n            }\n          }\n        }\n      }\n      images(first: 15) {\n        nodes {\n          id\n          url\n          altText\n          width\n          height\n        }\n      }\n    }\n  }\n}": types.ExportProductsDocument,
    "query ProductByIdentifier($handle: String!) {\n  productByIdentifier(identifier: {handle: $handle}) {\n    id\n    handle\n  }\n}": types.ProductByIdentifierDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CollectionAddProducts($id: ID!, $productIds: [ID!]!) {\n  collectionAddProducts(id: $id, productIds: $productIds) {\n    collection {\n      id\n    }\n    userErrors {\n      field\n      message\n    }\n  }\n}"): (typeof documents)["mutation CollectionAddProducts($id: ID!, $productIds: [ID!]!) {\n  collectionAddProducts(id: $id, productIds: $productIds) {\n    collection {\n      id\n    }\n    userErrors {\n      field\n      message\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CollectionCreate($input: CollectionInput!) {\n  collectionCreate(input: $input) {\n    collection {\n      id\n      handle\n    }\n    userErrors {\n      field\n      message\n    }\n  }\n}"): (typeof documents)["mutation CollectionCreate($input: CollectionInput!) {\n  collectionCreate(input: $input) {\n    collection {\n      id\n      handle\n    }\n    userErrors {\n      field\n      message\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation PublishablePublish($id: ID!, $input: [PublicationInput!]!) {\n  publishablePublish(id: $id, input: $input) {\n    userErrors {\n      field\n      message\n    }\n  }\n}"): (typeof documents)["mutation PublishablePublish($id: ID!, $input: [PublicationInput!]!) {\n  publishablePublish(id: $id, input: $input) {\n    userErrors {\n      field\n      message\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query CollectionProducts($id: ID!, $first: Int!, $cursor: String) {\n  collection(id: $id) {\n    products(first: $first, after: $cursor) {\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      nodes {\n        handle\n      }\n    }\n  }\n}"): (typeof documents)["query CollectionProducts($id: ID!, $first: Int!, $cursor: String) {\n  collection(id: $id) {\n    products(first: $first, after: $cursor) {\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      nodes {\n        handle\n      }\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query ExportCollections($first: Int!, $cursor: String, $query: String) {\n  collections(first: $first, after: $cursor, query: $query) {\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    nodes {\n      id\n      title\n      handle\n      descriptionHtml\n      sortOrder\n      templateSuffix\n      image {\n        url\n        altText\n      }\n      ruleSet {\n        appliedDisjunctively\n        rules {\n          column\n          relation\n          condition\n        }\n      }\n    }\n  }\n}"): (typeof documents)["query ExportCollections($first: Int!, $cursor: String, $query: String) {\n  collections(first: $first, after: $cursor, query: $query) {\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    nodes {\n      id\n      title\n      handle\n      descriptionHtml\n      sortOrder\n      templateSuffix\n      image {\n        url\n        altText\n      }\n      ruleSet {\n        appliedDisjunctively\n        rules {\n          column\n          relation\n          condition\n        }\n      }\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query ExportPublications($first: Int!) {\n  publications(first: $first) {\n    nodes {\n      id\n      name\n    }\n  }\n}"): (typeof documents)["query ExportPublications($first: Int!) {\n  publications(first: $first) {\n    nodes {\n      id\n      name\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation MetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {\n  metafieldDefinitionCreate(definition: $definition) {\n    createdDefinition {\n      id\n      name\n      namespace\n      key\n    }\n    userErrors {\n      field\n      message\n      code\n    }\n  }\n}"): (typeof documents)["mutation MetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {\n  metafieldDefinitionCreate(definition: $definition) {\n    createdDefinition {\n      id\n      name\n      namespace\n      key\n    }\n    userErrors {\n      field\n      message\n      code\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query ExportMetafieldDefinitions($ownerType: MetafieldOwnerType!, $first: Int!, $cursor: String) {\n  metafieldDefinitions(ownerType: $ownerType, first: $first, after: $cursor) {\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    nodes {\n      name\n      namespace\n      key\n      description\n      type {\n        name\n      }\n      ownerType\n    }\n  }\n}"): (typeof documents)["query ExportMetafieldDefinitions($ownerType: MetafieldOwnerType!, $first: Int!, $cursor: String) {\n  metafieldDefinitions(ownerType: $ownerType, first: $first, after: $cursor) {\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    nodes {\n      name\n      namespace\n      key\n      description\n      type {\n        name\n      }\n      ownerType\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation ProductSet($input: ProductSetInput!) {\n  productSet(input: $input, synchronous: true) {\n    product {\n      id\n      handle\n    }\n    userErrors {\n      field\n      message\n    }\n  }\n}"): (typeof documents)["mutation ProductSet($input: ProductSetInput!) {\n  productSet(input: $input, synchronous: true) {\n    product {\n      id\n      handle\n    }\n    userErrors {\n      field\n      message\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query ExportProducts($first: Int!, $cursor: String, $query: String) {\n  products(first: $first, after: $cursor, query: $query) {\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    nodes {\n      id\n      title\n      handle\n      descriptionHtml\n      productType\n      vendor\n      status\n      tags\n      options {\n        name\n        values\n      }\n      metafields(first: 50) {\n        nodes {\n          namespace\n          key\n          type\n          value\n        }\n      }\n      variants(first: 50) {\n        nodes {\n          id\n          title\n          sku\n          barcode\n          price\n          compareAtPrice\n          inventoryPolicy\n          inventoryItem {\n            tracked\n            measurement {\n              weight {\n                unit\n                value\n              }\n            }\n          }\n          selectedOptions {\n            name\n            value\n          }\n          position\n          metafields(first: 25) {\n            nodes {\n              namespace\n              key\n              type\n              value\n            }\n          }\n        }\n      }\n      images(first: 15) {\n        nodes {\n          id\n          url\n          altText\n          width\n          height\n        }\n      }\n    }\n  }\n}"): (typeof documents)["query ExportProducts($first: Int!, $cursor: String, $query: String) {\n  products(first: $first, after: $cursor, query: $query) {\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    nodes {\n      id\n      title\n      handle\n      descriptionHtml\n      productType\n      vendor\n      status\n      tags\n      options {\n        name\n        values\n      }\n      metafields(first: 50) {\n        nodes {\n          namespace\n          key\n          type\n          value\n        }\n      }\n      variants(first: 50) {\n        nodes {\n          id\n          title\n          sku\n          barcode\n          price\n          compareAtPrice\n          inventoryPolicy\n          inventoryItem {\n            tracked\n            measurement {\n              weight {\n                unit\n                value\n              }\n            }\n          }\n          selectedOptions {\n            name\n            value\n          }\n          position\n          metafields(first: 25) {\n            nodes {\n              namespace\n              key\n              type\n              value\n            }\n          }\n        }\n      }\n      images(first: 15) {\n        nodes {\n          id\n          url\n          altText\n          width\n          height\n        }\n      }\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query ProductByIdentifier($handle: String!) {\n  productByIdentifier(identifier: {handle: $handle}) {\n    id\n    handle\n  }\n}"): (typeof documents)["query ProductByIdentifier($handle: String!) {\n  productByIdentifier(identifier: {handle: $handle}) {\n    id\n    handle\n  }\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;